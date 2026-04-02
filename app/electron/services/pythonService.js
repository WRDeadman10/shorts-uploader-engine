const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { getRepoRoot } = require("./pathService");

function resolvePythonCommand()
{
    const repoRoot = getRepoRoot();
    const candidates = [
        {
            command: path.join(repoRoot, ".venv", "Scripts", "python.exe"),
            prefixArgs: []
        },
        {
            command: path.join(repoRoot, "venv", "Scripts", "python.exe"),
            prefixArgs: []
        },
        {
            command: "py",
            prefixArgs: ["-3"]
        },
        {
            command: "python",
            prefixArgs: []
        }
    ];

    for (const candidate of candidates)
    {
        if (path.isAbsolute(candidate.command) && !fs.existsSync(candidate.command))
        {
            continue;
        }

        try
        {
            const result = spawnSync(
                candidate.command,
                candidate.prefixArgs.concat(["--version"]),
                {
                    cwd: repoRoot,
                    windowsHide: true,
                    encoding: "utf8"
                }
            );

            if (result.status === 0)
            {
                return {
                    found: true,
                    command: candidate.command,
                    prefixArgs: candidate.prefixArgs
                };
            }
        }
        catch (_error)
        {
        }
    }

    return {
        found: false,
        command: "",
        prefixArgs: []
    };
}

module.exports = {
    resolvePythonCommand: resolvePythonCommand
};
