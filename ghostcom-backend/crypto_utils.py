import secrets
import string

def generate_secret_code(existing_codes, user_word=None, length=4):
    prefix = ''.join(secrets.choice(string.ascii_uppercase) for _ in range(3))
    suffix = ''.join(secrets.choice(string.digits) for _ in range(4))
    if user_word:
        word = ''.join(c for c in user_word.lower() if c.isalnum())[:8]
    else:
        word = ''.join(secrets.choice(string.ascii_lowercase) for _ in range(length))
    code = f"{prefix}-{word}-{suffix}"
    while code in existing_codes:
        prefix = ''.join(secrets.choice(string.ascii_uppercase) for _ in range(3))
        suffix = ''.join(secrets.choice(string.digits) for _ in range(4))
        code = f"{prefix}-{word}-{suffix}"
    return code