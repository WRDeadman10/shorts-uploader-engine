import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def generate_sample_hooks():
    sample_context = {
        "kills": 4,
        "site_name": "A site",
        "agent_name": "Jett",
        "weapon": "Operator",
        "headshots": 2,
        "victim_agent": "Reyna / Omen / Sova / Sage"
    }

    system_prompt = (
        "You are an expert at creating HIGH-ENGAGEMENT, HILARIOUS text overlays for TikTok/YouTube Shorts gaming clips. "
        "Your goal is to write a short 3-5 word 'Hook' that will be printed directly onto the video. "
        "It MUST be extremely funny, brainrot, Gen-Z, ironic, or sound like a toxic gamer's internal monologue. "
        "CRITICAL RULES: \n"
        "- NO NUMBERS ALLOWED AT ALL (e.g., do NOT say '4 kills', '1v4', '100%'). \n"
        "- NO PUNCTUATION except maybe a question mark. \n"
        "- NO EMOJIS.\n"
        "- KEEP IT SHORT (3 to 5 words max).\n"
        "- EXAMPLES OF VIBE: 'reyna uninstall right now', 'omen got absolutely deleted', 'my back hurts from carrying', 'average jett instalock activities', 'they actually thought they won'"
    )

    user_prompt = (
        f"Generate exactly 5 different funny, short hook ideas based on this Valorant clip context:\n"
        f"{json.dumps(sample_context, indent=2)}\n\n"
        "Return the output as a clean JSON list of strings."
    )

    print("Sending prompt to OpenAI...")
    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        temperature=1.0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt + "\n\nFormat as: {\"hooks\": [\"hook1\", ...]}"},
        ]
    )

    result = json.loads(response.choices[0].message.content)
    print("\n=== AI GENERATED HOOKS (ATTEMPT 2) ===")
    for idx, hook in enumerate(result.get("hooks", [])):
        print(f"{idx + 1}. {hook}")
    print("======================================")

if __name__ == "__main__":
    generate_sample_hooks()
