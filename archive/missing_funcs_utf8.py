def get_platform_upload_status(ledger_state: Dict[str, Any], state_key: str) -> str:
    entries = ledger_state.get('entries', {})
    if not isinstance(entries, dict):
        return ''
    row = entries.get(state_key, {})
    if not isinstance(row, dict):
        return ''
    return str(row.get('status', '')).strip().lower()
---
