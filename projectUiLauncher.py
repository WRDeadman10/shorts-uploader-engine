from __future__ import annotations

import json
import os
import queue
import shlex
import subprocess
import sys
import threading
import tkinter as tk
from dataclasses import dataclass, field
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText
from typing import Any, Callable, Dict, List, Optional, Tuple


ROOT_DIR = Path(__file__).resolve().parent
UI_STATE_FILE = ROOT_DIR / ".project_ui_launcher_state.json"


@dataclass
class OptionSpec:
    key: str
    label: str
    kind: str
    default: Any
    help_text: str
    flag: str = ""
    false_flag: str = ""
    choices: List[str] = field(default_factory=list)
    required: bool = False
    must_exist: bool = False
    min_value: Optional[float] = None
    browse_kind: str = ""


@dataclass
class ScriptSpec:
    tab_name: str
    script_name: str
    description: str
    options: List[OptionSpec]
    validator: Callable[[Dict[str, Any]], List[str]]


class ScriptTab:
    def __init__(
        self,
        master: ttk.Notebook,
        script_spec: ScriptSpec,
        initial_values: Optional[Dict[str, Any]],
        on_values_changed: Callable[[str, Dict[str, Any]], None],
    ) -> None:
        self.script_spec = script_spec
        self.initial_values = initial_values or {}
        self.on_values_changed = on_values_changed
        self.frame = ttk.Frame(master)
        self.variables: Dict[str, tk.Variable] = {}
        self.process: Optional[subprocess.Popen[str]] = None
        self.reader_thread: Optional[threading.Thread] = None
        self.output_queue: "queue.Queue[Tuple[str, str]]" = queue.Queue()
        self.loading_values = False

        self._build_ui()
        self.apply_initial_values()
        self._pump_output_queue()
        self.update_command_preview()

    def _build_ui(self) -> None:
        container = ttk.Frame(self.frame, padding=10)
        container.pack(fill="both", expand=True)

        header = ttk.Label(
            container,
            text=self.script_spec.description,
            justify="left",
            wraplength=1100,
        )
        header.pack(fill="x", pady=(0, 10))

        form_host = ttk.Frame(container)
        form_host.pack(fill="both", expand=True)

        canvas = tk.Canvas(form_host, highlightthickness=0)
        scrollbar = ttk.Scrollbar(form_host, orient="vertical", command=canvas.yview)
        self.form_frame = ttk.Frame(canvas)

        self.form_frame.bind(
            "<Configure>",
            lambda event: canvas.configure(scrollregion=canvas.bbox("all")),
        )

        canvas_window = canvas.create_window((0, 0), window=self.form_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        def on_canvas_configure(event: tk.Event[Any]) -> None:
            canvas.itemconfigure(canvas_window, width=event.width)

        canvas.bind("<Configure>", on_canvas_configure)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        for row_index, option in enumerate(self.script_spec.options):
            self._build_option_row(row_index, option)

        actions = ttk.Frame(container)
        actions.pack(fill="x", pady=(10, 8))

        self.run_button = ttk.Button(actions, text="Run Script", command=self.run_script)
        self.run_button.pack(side="left")

        self.stop_button = ttk.Button(actions, text="Stop", command=self.stop_script, state="disabled")
        self.stop_button.pack(side="left", padx=(8, 0))

        validate_button = ttk.Button(actions, text="Validate Inputs", command=self.validate_only)
        validate_button.pack(side="left", padx=(8, 0))

        clear_button = ttk.Button(actions, text="Clear Output", command=self.clear_output)
        clear_button.pack(side="left", padx=(8, 0))

        preview_label = ttk.Label(container, text="Command Preview")
        preview_label.pack(anchor="w")

        self.command_preview = ScrolledText(container, height=4, wrap="word")
        self.command_preview.pack(fill="x", pady=(0, 8))
        self.command_preview.configure(state="disabled")

        output_label = ttk.Label(container, text="Console Output")
        output_label.pack(anchor="w")

        self.output_box = ScrolledText(container, height=16, wrap="word")
        self.output_box.pack(fill="both", expand=True)
        self.output_box.configure(state="disabled")

    def _build_option_row(self, row_index: int, option: OptionSpec) -> None:
        label = ttk.Label(self.form_frame, text=option.label)
        label.grid(row=row_index, column=0, sticky="nw", padx=(0, 10), pady=6)

        field_frame = ttk.Frame(self.form_frame)
        field_frame.grid(row=row_index, column=1, sticky="ew", pady=6)
        self.form_frame.columnconfigure(1, weight=1)

        variable: tk.Variable
        widget: tk.Widget

        if option.kind == "bool":
            variable = tk.BooleanVar(value=bool(option.default))
            widget = ttk.Checkbutton(field_frame, variable=variable)
            widget.pack(side="left")
        elif option.kind == "choice":
            variable = tk.StringVar(value=str(option.default))
            widget = ttk.Combobox(
                field_frame,
                textvariable=variable,
                values=option.choices,
                state="readonly",
                width=36,
            )
            widget.pack(side="left", fill="x", expand=True)
        else:
            variable = tk.StringVar(value="" if option.default is None else str(option.default))
            widget = ttk.Entry(field_frame, textvariable=variable, width=72)
            widget.pack(side="left", fill="x", expand=True)

            if option.browse_kind:
                browse_button = ttk.Button(
                    field_frame,
                    text="Browse",
                    command=lambda spec=option: self.browse_for_option(spec),
                )
                browse_button.pack(side="left", padx=(8, 0))

        help_label = ttk.Label(
            self.form_frame,
            text=option.help_text,
            foreground="#555555",
            justify="left",
            wraplength=520,
        )
        help_label.grid(row=row_index, column=2, sticky="nw", padx=(10, 0), pady=6)

        self.variables[option.key] = variable
        self._attach_change_handler(variable)

    def _attach_change_handler(self, variable: tk.Variable) -> None:
        def on_change(*args: str) -> None:
            if self.loading_values:
                return
            self.persist_values()
            self.update_command_preview()

        variable.trace_add("write", on_change)

    def browse_for_option(self, option: OptionSpec) -> None:
        current_value = str(self.variables[option.key].get()).strip()
        initial_path = Path(current_value).expanduser() if current_value else ROOT_DIR
        initial_dir = initial_path if initial_path.is_dir() else initial_path.parent

        selected = ""
        if option.browse_kind == "file_open":
            selected = filedialog.askopenfilename(initialdir=str(initial_dir))
        elif option.browse_kind == "file_save":
            selected = filedialog.asksaveasfilename(
                initialdir=str(initial_dir),
                initialfile=initial_path.name if current_value else "",
            )
        elif option.browse_kind == "dir":
            selected = filedialog.askdirectory(initialdir=str(initial_dir))

        if selected:
            self.variables[option.key].set(selected)

    def get_raw_values(self) -> Dict[str, Any]:
        values: Dict[str, Any] = {}
        for option in self.script_spec.options:
            values[option.key] = self.variables[option.key].get()
        return values

    def apply_initial_values(self) -> None:
        if not self.initial_values:
            return

        self.loading_values = True
        try:
            for option in self.script_spec.options:
                if option.key not in self.initial_values:
                    continue
                self.variables[option.key].set(self.initial_values[option.key])
        finally:
            self.loading_values = False

    def persist_values(self) -> None:
        self.on_values_changed(self.script_spec.script_name, self.get_raw_values())

    def parse_values(self) -> Tuple[Dict[str, Any], List[str]]:
        raw_values = self.get_raw_values()
        parsed_values: Dict[str, Any] = {}
        errors: List[str] = []

        for option in self.script_spec.options:
            raw_value = raw_values[option.key]
            if option.kind == "bool":
                parsed_values[option.key] = bool(raw_value)
                continue

            text_value = str(raw_value).strip()

            if option.required and not text_value:
                errors.append(f"{option.label}: value is required.")
                continue

            if not text_value:
                parsed_values[option.key] = ""
                continue

            if option.kind == "int":
                try:
                    parsed_int = int(text_value)
                except ValueError:
                    errors.append(f"{option.label}: enter a valid integer.")
                    continue
                if option.min_value is not None and parsed_int < int(option.min_value):
                    errors.append(f"{option.label}: must be >= {int(option.min_value)}.")
                    continue
                parsed_values[option.key] = parsed_int
                continue

            if option.kind == "float":
                try:
                    parsed_float = float(text_value)
                except ValueError:
                    errors.append(f"{option.label}: enter a valid number.")
                    continue
                if option.min_value is not None and parsed_float < option.min_value:
                    errors.append(f"{option.label}: must be >= {option.min_value}.")
                    continue
                parsed_values[option.key] = parsed_float
                continue

            if option.kind == "choice" and option.choices and text_value not in option.choices:
                errors.append(f"{option.label}: invalid choice.")
                continue

            if option.must_exist:
                candidate = Path(text_value).expanduser()
                if not candidate.is_absolute():
                    candidate = (ROOT_DIR / candidate).resolve()
                if option.kind == "dir" and not candidate.is_dir():
                    errors.append(f"{option.label}: directory not found.")
                    continue
                if option.kind != "dir" and not candidate.exists():
                    errors.append(f"{option.label}: file not found.")
                    continue

            parsed_values[option.key] = text_value

        if errors:
            return parsed_values, errors

        errors.extend(self.script_spec.validator(parsed_values))
        return parsed_values, errors

    def build_command(self) -> Tuple[List[str], List[str]]:
        parsed_values, errors = self.parse_values()
        if errors:
            return [], errors

        command: List[str] = [
            sys.executable,
            "-u",
            str((ROOT_DIR / self.script_spec.script_name).resolve()),
        ]

        for option in self.script_spec.options:
            value = parsed_values.get(option.key)

            if option.kind == "bool":
                current_value = bool(value)
                default_value = bool(option.default)
                if current_value == default_value:
                    continue
                if current_value and option.flag:
                    command.append(option.flag)
                elif not current_value and option.false_flag:
                    command.append(option.false_flag)
                continue

            if value == "":
                continue

            default_value = "" if option.default is None else option.default
            if value == default_value:
                continue

            command.extend([option.flag, str(value)])

        return command, []

    def update_command_preview(self) -> None:
        command, errors = self.build_command()

        if errors:
            preview_text = "Validation issues:\n" + "\n".join(f"- {item}" for item in errors)
        else:
            preview_text = shlex.join(command)

        self.command_preview.configure(state="normal")
        self.command_preview.delete("1.0", "end")
        self.command_preview.insert("1.0", preview_text)
        self.command_preview.configure(state="disabled")

    def validate_only(self) -> None:
        _, errors = self.build_command()
        if errors:
            messagebox.showerror("Validation failed", "\n".join(errors), parent=self.frame)
            return
        messagebox.showinfo("Validation passed", "All inputs look valid.", parent=self.frame)

    def run_script(self) -> None:
        if self.process is not None:
            messagebox.showwarning("Script already running", "Wait for the current run to finish.", parent=self.frame)
            return

        command, errors = self.build_command()
        if errors:
            messagebox.showerror("Validation failed", "\n".join(errors), parent=self.frame)
            return

        self.persist_values()
        self.append_output(f"$ {shlex.join(command)}\n")

        try:
            env = dict(os.environ)
            env["PYTHONUNBUFFERED"] = "1"
            self.process = subprocess.Popen(
                command,
                cwd=str(ROOT_DIR),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except OSError as exc:
            self.process = None
            messagebox.showerror("Launch failed", str(exc), parent=self.frame)
            return

        self.run_button.configure(state="disabled")
        self.stop_button.configure(state="normal")

        self.reader_thread = threading.Thread(target=self._read_process_output, daemon=True)
        self.reader_thread.start()

    def stop_script(self) -> None:
        if self.process is None:
            return

        self.append_output("[ui] stop requested\n")
        try:
            self.process.terminate()
        except OSError as exc:
            self.append_output(f"[ui] failed to stop process: {exc}\n")

    def _read_process_output(self) -> None:
        if self.process is None or self.process.stdout is None:
            return

        try:
            for line in self.process.stdout:
                self.output_queue.put(("line", line))
        finally:
            return_code = self.process.wait()
            self.output_queue.put(("done", f"[ui] process exited with code {return_code}\n"))

    def _pump_output_queue(self) -> None:
        while True:
            try:
                message_type, payload = self.output_queue.get_nowait()
            except queue.Empty:
                break

            self.append_output(payload)

            if message_type == "done":
                self.process = None
                self.reader_thread = None
                self.run_button.configure(state="normal")
                self.stop_button.configure(state="disabled")

        self.frame.after(150, self._pump_output_queue)

    def append_output(self, text: str) -> None:
        self.output_box.configure(state="normal")
        self.output_box.insert("end", text)
        self.output_box.see("end")
        self.output_box.configure(state="disabled")

    def clear_output(self) -> None:
        self.output_box.configure(state="normal")
        self.output_box.delete("1.0", "end")
        self.output_box.configure(state="disabled")


def resolve_path(value: str) -> Path:
    candidate = Path(value).expanduser()
    if candidate.is_absolute():
        return candidate
    return (ROOT_DIR / candidate).resolve()


def validate_youtube(values: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    root_value = str(values.get("root", "")).strip()
    if not root_value:
        errors.append("Videos Root: value is required.")
    elif not resolve_path(root_value).is_dir():
        errors.append("Videos Root: directory not found.")

    shorts_policy = str(values.get("shorts_policy", "")).strip()
    if shorts_policy != "off":
        if not str(values.get("ffmpeg_bin", "")).strip():
            errors.append("FFmpeg Bin: value is required when Shorts Policy is not off.")
        if not str(values.get("ffprobe_bin", "")).strip():
            errors.append("FFprobe Bin: value is required when Shorts Policy is not off.")

    if str(values.get("music_dir", "")).strip() and not resolve_path(str(values["music_dir"])).is_dir():
        errors.append("Music Directory: directory not found.")

    if bool(values.get("crosspost_meta")) and not bool(values.get("dry_run")):
        if not str(values.get("meta_access_token", "")).strip():
            errors.append("Meta Access Token: value is required when Meta cross-posting is enabled.")

        meta_platform = str(values.get("meta_platform", "both")).strip()
        if meta_platform in {"both", "instagram"} and not str(values.get("meta_ig_user_id", "")).strip():
            errors.append("Meta Instagram User ID: value is required for Instagram Meta cross-posting.")
        if meta_platform in {"both", "facebook"} and not str(values.get("meta_facebook_page_id", "")).strip():
            errors.append("Meta Facebook Page ID: value is required for Facebook Meta cross-posting.")

    if str(values.get("upload_platform", "youtube")).strip() == "youtube" and not bool(values.get("dry_run")):
        client_secrets = str(values.get("client_secrets", "")).strip()
        if not client_secrets:
            errors.append("Client Secrets JSON: value is required for YouTube uploads.")
        elif not resolve_path(client_secrets).exists():
            errors.append("Client Secrets JSON: file not found.")

    return errors


def validate_meta(values: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    source_state_file = str(values.get("source_state_file", "")).strip()
    if not source_state_file:
        errors.append("Source State File: value is required.")
    elif not resolve_path(source_state_file).exists():
        errors.append("Source State File: file not found.")

    videos_root = str(values.get("videos_root", "")).strip()
    if not videos_root:
        errors.append("Videos Root: value is required.")
    elif not resolve_path(videos_root).is_dir():
        errors.append("Videos Root: directory not found.")

    if not bool(values.get("dry_run")):
        if not str(values.get("access_token", "")).strip():
            errors.append("Meta Access Token: value is required.")

        platform = str(values.get("platform", "both")).strip()
        if platform in {"both", "instagram"} and not str(values.get("ig_user_id", "")).strip():
            errors.append("Instagram User ID: value is required for Instagram uploads.")
        if platform in {"both", "facebook"} and not str(values.get("facebook_page_id", "")).strip():
            errors.append("Facebook Page ID: value is required for Facebook uploads.")

    return errors


def validate_fix_metadata(values: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    state_file = str(values.get("state_file", "")).strip()
    if not state_file:
        errors.append("State File: value is required.")
    elif not resolve_path(state_file).exists():
        errors.append("State File: file not found.")

    metadata_dir = str(values.get("metadata_dir", "")).strip()
    if metadata_dir and not resolve_path(metadata_dir).exists():
        errors.append("Metadata Directory: directory not found.")

    if not bool(values.get("dry_run")):
        client_secrets = str(values.get("client_secrets", "")).strip()
        if not client_secrets:
            errors.append("Client Secrets JSON: value is required.")
        elif not resolve_path(client_secrets).exists():
            errors.append("Client Secrets JSON: file not found.")

    return errors


def validate_music_sample(values: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    music_dir = str(values.get("music_dir", "")).strip()
    if not music_dir:
        errors.append("Music Directory: value is required.")
    elif not resolve_path(music_dir).is_dir():
        errors.append("Music Directory: directory not found.")

    sample_video = str(values.get("sample_video", "")).strip()
    if sample_video and not resolve_path(sample_video).exists():
        errors.append("Sample Video: file not found.")

    sample_music = str(values.get("sample_music", "")).strip()
    if sample_music and not resolve_path(sample_music).exists():
        errors.append("Sample Music: file not found.")

    if not sample_video:
        youtube_state_file = str(values.get("youtube_state_file", "")).strip()
        if not youtube_state_file:
            errors.append("YouTube State File: value is required when Sample Video is empty.")
        elif not resolve_path(youtube_state_file).exists():
            errors.append("YouTube State File: file not found.")

    return errors


def build_script_specs() -> List[ScriptSpec]:
    youtube_options: List[OptionSpec] = [
        OptionSpec("root", "Videos Root", "dir", ".", "Root directory to recursively scan for videos.", "--root", browse_kind="dir"),
        OptionSpec("extensions", "Extensions", "text", ".mp4,.mov,.mkv,.webm", "Comma-separated list of video extensions.", "--extensions"),
        OptionSpec("exclude_dirs", "Exclude Directories", "text", ".git,__pycache__,generated_metadata,converted_shorts", "Comma-separated directory names to skip while scanning for videos.", "--exclude-dirs"),
        OptionSpec("exclude_files", "Exclude Files", "text", "shorts_crop_preview.mp4", "Comma-separated file names to skip while scanning for videos.", "--exclude-files"),
        OptionSpec("max_videos", "Max Videos", "int", 0, "Limit number of uploads. Use 0 for all discovered videos.", "--max-videos", min_value=0),
        OptionSpec("privacy", "Privacy", "choice", "public", "YouTube privacy setting.", "--privacy", choices=["private", "public", "unlisted"]),
        OptionSpec("playlist_name", "Playlist Name", "text", "Valorant", "Playlist title to add each uploaded video to. Leave empty to disable.", "--playlist-name"),
        OptionSpec("upload_platform", "Upload Platform", "choice", "youtube", "Choose which platform this run should upload to.", "--upload-platform", choices=["youtube", "instagram", "facebook"]),
        OptionSpec("require_uploaded_on", "Require Uploaded On", "text", "", "Comma-separated platforms that must already have the clip uploaded before it is queued.", "--require-uploaded-on"),
        OptionSpec("require_missing_on", "Require Missing On", "text", "", "Comma-separated platforms that must not already have the clip uploaded before it is queued.", "--require-missing-on"),
        OptionSpec("client_secrets", "Client Secrets JSON", "text", "client_secret.json", "Path to YouTube OAuth client secrets JSON.", "--client-secrets", browse_kind="file_open"),
        OptionSpec("auth_port", "OAuth Port", "int", 8080, "Local port used by OAuth callback server.", "--auth-port", min_value=1),
        OptionSpec("token_file", "Token File", "text", "token.json", "Path to store OAuth access token JSON.", "--token-file", browse_kind="file_save"),
        OptionSpec("state_file", "State File", "text", ".youtube_upload_state.json", "Path to upload state file.", "--state-file", browse_kind="file_save"),
        OptionSpec("youtube_upload_ledger_file", "YouTube Ledger File", "text", ".youtube_uploaded_videos.json", "Path to per-video YouTube upload ledger JSON.", "--youtube-upload-ledger-file", browse_kind="file_save"),
        OptionSpec("instagram_upload_ledger_file", "Instagram Ledger File", "text", ".instagram_uploaded_videos.json", "Path to per-video Instagram upload ledger JSON.", "--instagram-upload-ledger-file", browse_kind="file_save"),
        OptionSpec("facebook_upload_ledger_file", "Facebook Ledger File", "text", ".facebook_uploaded_videos.json", "Path to per-video Facebook upload ledger JSON.", "--facebook-upload-ledger-file", browse_kind="file_save"),
        OptionSpec("metadata_dir", "Metadata Directory", "text", "generated_metadata", "Directory to store generated metadata JSON per uploaded file.", "--metadata-dir", browse_kind="dir"),
        OptionSpec("shorts_policy", "Shorts Policy", "choice", "convert", "How to enforce Shorts format.", "--shorts-policy", choices=["off", "strict", "convert"]),
        OptionSpec("shorts_max_seconds", "Shorts Max Seconds", "int", 180, "Maximum Shorts duration in seconds.", "--shorts-max-seconds", min_value=1),
        OptionSpec("converted_dir", "Converted Directory", "text", "converted_shorts", "Directory to store converted Shorts files.", "--converted-dir", browse_kind="dir"),
        OptionSpec("ffmpeg_bin", "FFmpeg Bin", "text", "ffmpeg", "Path to ffmpeg binary for conversion.", "--ffmpeg-bin", browse_kind="file_open"),
        OptionSpec("ffprobe_bin", "FFprobe Bin", "text", "ffprobe", "Path to ffprobe binary for media inspection.", "--ffprobe-bin", browse_kind="file_open"),
        OptionSpec("openai_model", "OpenAI Model", "text", "gpt-4.1-mini", "OpenAI model used to generate metadata.", "--openai-model"),
        OptionSpec("channel_name", "Channel Name", "text", "", "Optional channel name or tone hint for the AI prompt.", "--channel-name"),
        OptionSpec("instagram_username", "Instagram Username", "text", "", "Instagram username to mention in YouTube descriptions.", "--instagram-username"),
        OptionSpec("youtube_username", "YouTube Username", "text", "", "YouTube username to mention in Instagram captions.", "--youtube-username"),
        OptionSpec("extra_keywords", "Extra Keywords", "text", "valorant,valorant clips,shorts,gaming,fps", "Comma-separated keywords to guide metadata generation.", "--extra-keywords"),
        OptionSpec("language", "Language", "text", "en", "Default language for video metadata.", "--language"),
        OptionSpec("category_id", "Category ID", "text", "20", "YouTube category ID. 20 means Gaming.", "--category-id"),
        OptionSpec("notify_subscribers", "Notify Subscribers", "bool", False, "Send upload notifications to subscribers.", "--notify-subscribers"),
        OptionSpec("dry_run", "Dry Run", "bool", False, "Generate metadata and preview actions without uploading.", "--dry-run"),
        OptionSpec("skip_uploaded", "Skip Uploaded", "bool", True, "Skip files already present in the state file.", "--skip-uploaded", "--no-skip-uploaded"),
        OptionSpec("no_ai", "Disable AI", "bool", False, "Disable OpenAI metadata generation and use fallback metadata.", "--no-ai"),
        OptionSpec("require_ai", "Require AI", "bool", True, "Fail the file if AI metadata is unavailable.", "--require-ai", "--allow-fallback"),
        OptionSpec("metadata_history_file", "Metadata History File", "text", ".metadata_history.json", "History file used to avoid repeated titles and descriptions.", "--metadata-history-file", browse_kind="file_save"),
        OptionSpec("ai_uniqueness_window", "AI Uniqueness Window", "int", 500, "Recent title and description count used for uniqueness checks.", "--ai-uniqueness-window", min_value=1),
        OptionSpec("ai_metadata_retries", "AI Metadata Retries", "int", 4, "OpenAI regeneration attempts for unique metadata.", "--ai-metadata-retries", min_value=1),
        OptionSpec("delete_converted_after_upload", "Delete Converted After Upload", "bool", True, "Delete temporary converted files after successful upload.", "--delete-converted-after-upload", "--keep-converted-after-upload"),
        OptionSpec("music_dir", "Music Directory", "text", "", "Optional directory of MP3 files to mix under each upload.", "--music-dir", browse_kind="dir"),
        OptionSpec("music_inventory_file", "Music Inventory File", "text", "hollywood_music_inventory.json", "Path to save the discovered MP3 inventory.", "--music-inventory-file", browse_kind="file_save"),
        OptionSpec("music_bg_volume", "Music Background Volume", "float", 0.18, "Relative background music volume or weight.", "--music-bg-volume", min_value=0.0),
        OptionSpec("crosspost_meta", "Cross-Post To Meta", "bool", False, "After YouTube upload, also upload the same file to Instagram or Facebook Reels.", "--crosspost-meta"),
        OptionSpec("meta_platform", "Meta Platform", "choice", "both", "Meta platform selection for cross-posting.", "--meta-platform", choices=["both", "instagram", "facebook"]),
        OptionSpec("meta_reels_state_file", "Meta Reels State File", "text", ".meta_reels_upload_state.json", "Path to save Meta reels upload state.", "--meta-reels-state-file", browse_kind="file_save"),
        OptionSpec("meta_graph_version", "Meta Graph Version", "text", "v25.0", "Meta Graph API version used for cross-posting.", "--meta-graph-version"),
        OptionSpec("meta_access_token", "Meta Access Token", "text", "", "Meta Page access token for cross-posting.", "--meta-access-token"),
        OptionSpec("meta_ig_user_id", "Meta Instagram User ID", "text", "", "Instagram professional account ID for cross-posting.", "--meta-ig-user-id"),
        OptionSpec("meta_facebook_page_id", "Meta Facebook Page ID", "text", "", "Facebook Page ID for cross-posting.", "--meta-facebook-page-id"),
        OptionSpec("meta_poll_attempts", "Meta Poll Attempts", "int", 30, "Max status polling attempts for Instagram reel readiness.", "--meta-poll-attempts", min_value=1),
        OptionSpec("meta_poll_interval_seconds", "Meta Poll Interval Seconds", "float", 4.0, "Seconds between Instagram reel status polls.", "--meta-poll-interval-seconds", min_value=0.0),
        OptionSpec("meta_request_timeout_seconds", "Meta Request Timeout Seconds", "float", 120.0, "HTTP timeout for each Meta API request.", "--meta-request-timeout-seconds", min_value=1.0),
        OptionSpec("meta_skip_uploaded", "Meta Skip Uploaded", "bool", True, "Skip Meta cross-posts already marked successful.", "--meta-skip-uploaded", "--no-meta-skip-uploaded"),
        OptionSpec("meta_instagram_retries", "Meta Instagram Retries", "int", 3, "Retry count for transient Instagram processing failures.", "--meta-instagram-retries", min_value=1),
        OptionSpec("meta_instagram_retry_delay_seconds", "Meta Instagram Retry Delay Seconds", "float", 20.0, "Delay between Instagram processing retries.", "--meta-instagram-retry-delay-seconds", min_value=0.0),
    ]

    meta_options: List[OptionSpec] = [
        OptionSpec("source_state_file", "Source State File", "text", ".youtube_upload_state.json", "Path to YouTube upload state file used as source input.", "--source-state-file", browse_kind="file_open"),
        OptionSpec("reels_state_file", "Reels State File", "text", ".meta_reels_upload_state.json", "Path to save Instagram and Facebook reels upload state.", "--reels-state-file", browse_kind="file_save"),
        OptionSpec("instagram_upload_ledger_file", "Instagram Ledger File", "text", ".instagram_uploaded_videos.json", "Path to per-video Instagram upload ledger JSON.", "--instagram-upload-ledger-file", browse_kind="file_save"),
        OptionSpec("facebook_upload_ledger_file", "Facebook Ledger File", "text", ".facebook_uploaded_videos.json", "Path to per-video Facebook upload ledger JSON.", "--facebook-upload-ledger-file", browse_kind="file_save"),
        OptionSpec("videos_root", "Videos Root", "text", ".", "Root directory used to resolve relative source video paths.", "--videos-root", browse_kind="dir"),
        OptionSpec("converted_dir", "Converted Directory", "text", "converted_shorts", "Directory containing temporary converted shorts.", "--converted-dir", browse_kind="dir"),
        OptionSpec("platform", "Platform", "choice", "both", "Choose where to upload reels.", "--platform", choices=["both", "instagram", "facebook"]),
        OptionSpec("graph_version", "Graph Version", "text", "v25.0", "Meta Graph API version.", "--graph-version"),
        OptionSpec("access_token", "Meta Access Token", "text", "", "Meta Page access token.", "--access-token"),
        OptionSpec("ig_user_id", "Instagram User ID", "text", "", "Instagram professional account ID.", "--ig-user-id"),
        OptionSpec("facebook_page_id", "Facebook Page ID", "text", "", "Facebook Page ID.", "--facebook-page-id"),
        OptionSpec("max_videos", "Max Videos", "int", 0, "Limit number of source videos processed. Use 0 for all.", "--max-videos", min_value=0),
        OptionSpec("skip_uploaded", "Skip Uploaded", "bool", True, "Skip uploads already marked successful in reels state.", "--skip-uploaded", "--no-skip-uploaded"),
        OptionSpec("poll_attempts", "Poll Attempts", "int", 30, "Max status polling attempts for Instagram container readiness.", "--poll-attempts", min_value=1),
        OptionSpec("poll_interval_seconds", "Poll Interval Seconds", "float", 4.0, "Seconds between status polling attempts.", "--poll-interval-seconds", min_value=0.0),
        OptionSpec("request_timeout_seconds", "Request Timeout Seconds", "float", 120.0, "HTTP timeout for each API request.", "--request-timeout-seconds", min_value=1.0),
        OptionSpec("delete_converted_after_upload", "Delete Converted After Upload", "bool", True, "Delete temporary converted files after successful upload.", "--delete-converted-after-upload", "--keep-converted-after-upload"),
        OptionSpec("dry_run", "Dry Run", "bool", False, "Show planned actions without calling Meta APIs.", "--dry-run"),
    ]

    fix_options: List[OptionSpec] = [
        OptionSpec("state_file", "State File", "text", ".youtube_upload_state.json", "Path to upload state JSON created by youtubeBatchUpload.py.", "--state-file", browse_kind="file_open"),
        OptionSpec("metadata_dir", "Metadata Directory", "text", "generated_metadata", "Directory containing local metadata JSON records.", "--metadata-dir", browse_kind="dir"),
        OptionSpec("client_secrets", "Client Secrets JSON", "text", "client_secret.json", "Path to YouTube OAuth client secrets JSON.", "--client-secrets", browse_kind="file_open"),
        OptionSpec("token_file", "Token File", "text", "token.json", "Path to store OAuth access token JSON.", "--token-file", browse_kind="file_save"),
        OptionSpec("auth_port", "OAuth Port", "int", 8080, "Local port used by OAuth callback server.", "--auth-port", min_value=1),
        OptionSpec("mode", "Mode", "choice", "duplicates", "Choose whether to update only duplicates or all uploaded videos.", "--mode", choices=["duplicates", "all"]),
        OptionSpec("keep_first", "Keep First Duplicate", "bool", True, "In duplicates mode, keep the first copy unchanged.", "--keep-first", "--no-keep-first"),
        OptionSpec("max_updates", "Max Updates", "int", 0, "Limit number of videos to update. Use 0 for all.", "--max-updates", min_value=0),
        OptionSpec("dry_run", "Dry Run", "bool", False, "Preview updates without writing to YouTube or local JSON files.", "--dry-run"),
    ]

    music_options: List[OptionSpec] = [
        OptionSpec("music_dir", "Music Directory", "text", "", "Directory containing MP3 files.", "--music-dir", required=True, browse_kind="dir"),
        OptionSpec("inventory_output", "Inventory Output", "text", "hollywood_music_inventory.json", "Path to save the generated music inventory JSON.", "--inventory-output", browse_kind="file_save"),
        OptionSpec("sample_video", "Sample Video", "text", "", "Optional explicit video path for the sample output.", "--sample-video", browse_kind="file_open"),
        OptionSpec("sample_music", "Sample Music", "text", "", "Optional explicit MP3 path for the sample output.", "--sample-music", browse_kind="file_open"),
        OptionSpec("sample_output", "Sample Output", "text", "sample_video_with_music.mp4", "Path to write the mixed sample video.", "--sample-output", browse_kind="file_save"),
        OptionSpec("youtube_state_file", "YouTube State File", "text", ".youtube_upload_state.json", "YouTube upload state file used to auto-pick an existing converted sample video.", "--youtube-state-file", browse_kind="file_open"),
        OptionSpec("ffprobe_bin", "FFprobe Bin", "text", "ffprobe", "Path to ffprobe binary.", "--ffprobe-bin", browse_kind="file_open"),
        OptionSpec("ffmpeg_bin", "FFmpeg Bin", "text", "ffmpeg", "Path to ffmpeg binary.", "--ffmpeg-bin", browse_kind="file_open"),
        OptionSpec("bg_volume", "Background Volume", "float", 0.18, "Relative weight or volume for the background music layer.", "--bg-volume", min_value=0.0),
    ]

    return [
        ScriptSpec(
            tab_name="YouTube Upload",
            script_name="youtubeBatchUpload.py",
            description="Run the main uploader with all supported arguments, validation, and live console output.",
            options=youtube_options,
            validator=validate_youtube,
        ),
        ScriptSpec(
            tab_name="Meta Reels",
            script_name="metaBatchReelsUpload.py",
            description="Cross-post previously uploaded clips to Instagram and Facebook Reels.",
            options=meta_options,
            validator=validate_meta,
        ),
        ScriptSpec(
            tab_name="Fix Metadata",
            script_name="youtubeFixRepeatedMetadata.py",
            description="Repair repeated YouTube titles and descriptions for previously uploaded videos.",
            options=fix_options,
            validator=validate_fix_metadata,
        ),
        ScriptSpec(
            tab_name="Music Sample",
            script_name="musicOverlaySample.py",
            description="Build the music inventory and create a sample video with background music mixed under the original audio.",
            options=music_options,
            validator=validate_music_sample,
        ),
    ]


def load_ui_state() -> Dict[str, Dict[str, Any]]:
    if not UI_STATE_FILE.exists():
        return {}

    try:
        payload = json.loads(UI_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(payload, dict):
        return {}

    cleaned: Dict[str, Dict[str, Any]] = {}
    for script_name, values in payload.items():
        if not isinstance(script_name, str) or not isinstance(values, dict):
            continue
        cleaned[script_name] = values
    return cleaned


def save_ui_state(state: Dict[str, Dict[str, Any]]) -> None:
    try:
        UI_STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except OSError:
        pass


class LauncherApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.saved_state = load_ui_state()
        self.root.title("Shorts Uploader Engine UI")
        self.root.geometry("1400x900")
        self.root.minsize(1180, 760)

        main_frame = ttk.Frame(root, padding=10)
        main_frame.pack(fill="both", expand=True)

        info_label = ttk.Label(
            main_frame,
            text=(
                f"Workspace: {ROOT_DIR}\n"
                "This UI only launches the existing scripts. It does not modify their code paths."
            ),
            justify="left",
        )
        info_label.pack(fill="x", pady=(0, 10))

        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill="both", expand=True)

        self.tabs: List[ScriptTab] = []
        for script_spec in build_script_specs():
            script_tab = ScriptTab(
                notebook,
                script_spec,
                self.saved_state.get(script_spec.script_name),
                self.on_tab_values_changed,
            )
            notebook.add(script_tab.frame, text=script_spec.tab_name)
            self.tabs.append(script_tab)

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def on_tab_values_changed(self, script_name: str, values: Dict[str, Any]) -> None:
        self.saved_state[script_name] = values
        save_ui_state(self.saved_state)

    def on_close(self) -> None:
        save_ui_state(self.saved_state)
        self.root.destroy()


def main() -> int:
    root = tk.Tk()
    ttk.Style(root).theme_use("clam")
    LauncherApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
