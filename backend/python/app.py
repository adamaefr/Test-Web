from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pymysql
import requests
import time
import re
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Load configuration from environment variables. DO NOT commit real secrets.
# Provide values via environment variables or a .env in development (not committed).
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'game1.vndel.com'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'u254_KkTfSGegsD'),
    'password': os.environ.get('DB_PASSWORD', 'axZP6@WLp+^SYct9NF6weRx'),
    'database': os.environ.get('DB_NAME', 's254_AMSTERDAM')
}

DISCORD_WEBHOOK = os.environ.get('DISCORD_WEBHOOK')
ROLE_MENTION = os.environ.get('DISCORD_ROLE_MENTION', '')
LOGO_URL = os.environ.get('LOGO_URL', 'https://your-domain.com/assets/ames.gif')
DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID')
DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET')
DISCORD_BOT_TOKEN = os.environ.get('DISCORD_BOT_TOKEN')
DISCORD_REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI')

# تتبع الطلبات
request_tracker = {}
blocked_ips = set()
blocked_info = {}
site_shutdown = False

# مستويات الهجمات
ATTACK_LEVELS = {
    'LOW': {'name': 'ضعيفة 😴', 'color': 0x00ff00, 'emoji': '🟢'},
    'MEDIUM': {'name': 'متوسطة 😏', 'color': 0xffff00, 'emoji': '🟡'},
    'HIGH': {'name': 'قوية 😤', 'color': 0xff9900, 'emoji': '🟠'},
    'CRITICAL': {'name': 'خطيرة جداً 🔥', 'color': 0xff0000, 'emoji': '🔴'},
    'EXTREME': {'name': 'كارثية 💀', 'color': 0x8b0000, 'emoji': '⚫'}
}

TAUNTS = [
    'يا حبيبي فاكر نفسك هكر؟ 😂 رح العب ماين كرافت أحسنلك',
    'واو! محاولة جميلة... بس فاشلة 🤣',
    'تعبت وأنت تحاول؟ خلي أجيبلك كرسي 💺😂',
    'الحماية بتاعتنا أقوى من محاولاتك الفاشلة 🛡️',
    'حاول مرة تانية... بعد 100 سنة يمكن تنجح 🤷‍♂️',
    'أنت جاي تهاجم ولا جاي تتفرج؟ 🎭😂',
    'يا عم روح ذاكر أحسنلك، الهكر مش مجالك 📚',
    'محاولة 10/10... للفشل 😎',
    '404 - مهاراتك غير موجودة 🤣',
    'AMSTERDAM County أقوى منك ومن أصحابك 💪🔥'
]

db_connection = None

def connect_db():
    global db_connection
    try:
        db_connection = pymysql.connect(**DB_CONFIG)
        print('✅ تم الاتصال بقاعدة البيانات')
        return True
    except Exception as e:
        print(f'❌ فشل الاتصال بقاعدة البيانات: {e}')
        return False

def send_discord_alert(attack_data):
    try:
        import random
        taunt = random.choice(TAUNTS)
        level = ATTACK_LEVELS.get(attack_data.get('level', 'LOW'), ATTACK_LEVELS['LOW'])

        embed = {
            'title': f"{level['emoji']} تنبيه هجوم - {level['name']}",
            'color': level['color'],
            'thumbnail': {'url': LOGO_URL},
            'fields': [
                {'name': '📍 نوع الهجوم', 'value': attack_data.get('type', 'غير محدد'), 'inline': True},
                {'name': '🌐 IP المهاجم', 'value': attack_data.get('ip', 'غير معروف'), 'inline': True},
                {'name': '⏰ الوقت', 'value': datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 'inline': True},
                {'name': '📊 عدد المحاولات', 'value': f"{attack_data.get('attempts', 0)} محاولة", 'inline': True},
                {'name': '🎯 الهدف', 'value': attack_data.get('target', 'غير محدد'), 'inline': True},
                {'name': '🚫 الحالة', 'value': 'تم الحظر ✅' if attack_data.get('blocked') else 'تحت المراقبة 👀', 'inline': True},
                {'name': '💬 رسالة للمهاجم', 'value': taunt, 'inline': False}
            ],
            'footer': {'text': '🛡️ AMSTERDAM County - أقوى نظام حماية في الشرق الأوسط', 'icon_url': LOGO_URL},
            'timestamp': datetime.now().isoformat()
        }

        content = None
        if attack_data.get('level') in ['EXTREME', 'CRITICAL']:
            content = f"{ROLE_MENTION} ⚠️ **تحذير عاجل!** هجوم {level['name']} على الموقع!"

        payload = {'content': content, 'embeds': [embed]}
        if DISCORD_WEBHOOK:
            requests.post(DISCORD_WEBHOOK, json=payload)
    except Exception as e:
        print(f'فشل إرسال تنبيه Discord: {e}')

def determine_attack_level(attempts, attack_type):
    if attempts > 500:
        return 'EXTREME'
    elif attempts > 200:
        return 'CRITICAL'
    elif attempts > 100:
        return 'HIGH'
    elif attempts > 50:
        return 'MEDIUM'
    return 'LOW'

def detect_attack_pattern(ip, path, method):
    now = time.time()
    key = f"{ip}:{int(now)}"

    if ip not in request_tracker:
        request_tracker[ip] = []

    requests_list = request_tracker[ip]
    requests_list.append({'time': now, 'path': path, 'method': method})

    # حذف الطلبات القديمة (أكثر من دقيقة)
    recent_requests = [r for r in requests_list if now - r['time'] < 60]
    request_tracker[ip] = recent_requests

    return len(recent_requests)

def has_sql_injection(input_str):
    sql_patterns = [
        r'\b(SELECT|UNION|DROP|INSERT|UPDATE|DELETE)\b',
        r'--',
        r';',
        r'/\*',
        r'\*/',
        r'xp_',
        r'sp_',
        r"'\s*OR\s*'1'\s*=\s*'1",
        r'" OR "1"="1'
    ]
    return any(re.search(pattern, input_str, re.IGNORECASE) for pattern in sql_patterns)

def has_xss(input_str):
    xss_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe',
        r'<embed',
        r'<object'
    ]
    return any(re.search(pattern, input_str, re.IGNORECASE) for pattern in xss_patterns)

def has_path_traversal(input_str):
    path_patterns = [
        r'\.\.',
        r'\.\./+',
        r'\.\.\\+',
        r'%2e%2e',
        r'etc/passwd',
        r'windows/system'
    ]
    return any(re.search(pattern, input_str, re.IGNORECASE) for pattern in path_patterns)

@app.before_request
def security_middleware():
    global site_shutdown

    if site_shutdown:
        return jsonify({
            'error': 'الموقع متوقف مؤقتاً بسبب هجمة قوية',
            'message': 'نعتذر عن الإزعاج. جاري التعامل مع التهديد الأمني.',
            'shutdownReason': 'هجوم DDoS قوي جداً'
        }), 503

    ip = request.remote_addr or 'unknown'
    path = request.path
    method = request.method

    if ip in blocked_ips:
        send_discord_alert({
            'type': '🚫 محاولة وصول من IP محظور',
            'ip': ip,
            'attempts': 1,
            'level': 'MEDIUM',
            'target': path,
            'blocked': True
        })
        return jsonify({
            'error': 'تم حظرك من الوصول للموقع',
            'message': 'IP الخاص بك محظور بسبب نشاط مشبوه 🚫'
        }), 403

    request_count = detect_attack_pattern(ip, path, method)

    if request_count > 100:
        level = determine_attack_level(request_count, 'Rate Limit')
        blocked_ips.add(ip)
        blocked_info[ip] = datetime.now().isoformat()

        send_discord_alert({
            'type': '⚡ هجوم Rate Limiting / DDoS',
            'ip': ip,
            'attempts': request_count,
            'level': level,
            'target': path,
            'blocked': True
        })

        if level in ['EXTREME', 'CRITICAL']:
            site_shutdown = True
            # إعادة تشغيل بعد 5 دقائق
            import threading
            def reset_shutdown():
                time.sleep(300)
                global site_shutdown
                site_shutdown = False
            threading.Thread(target=reset_shutdown).start()

        return jsonify({
            'error': 'عدد الطلبات كثير جداً',
            'message': 'هادي شوية يا هكر 😂',
            'blockedUntil': 'دائم'
        }), 429

    # فحص المدخلات
    all_inputs = str(request.args) + str(request.form) + str(request.get_json(silent=True) or {})
    if has_sql_injection(all_inputs):
        blocked_ips.add(ip)
        blocked_info[ip] = datetime.now().isoformat()
        send_discord_alert({
            'type': '💉 محاولة SQL Injection',
            'ip': ip,
            'attempts': request_count,
            'level': 'HIGH',
            'target': path,
            'blocked': True
        })
        return jsonify({
            'error': 'محاولة SQL Injection مكتشفة',
            'message': 'فاكر نفسك ذكي؟ 😂 حماية AMSTERDAM أقوى منك!'
        }), 400

    if has_xss(all_inputs):
        blocked_ips.add(ip)
        blocked_info[ip] = datetime.now().isoformat()
        send_discord_alert({
            'type': '🎭 محاولة XSS Attack',
            'ip': ip,
            'attempts': request_count,
            'level': 'HIGH',
            'target': path,
            'blocked': True
        })
        return jsonify({
            'error': 'محاولة XSS مكتشفة',
            'message': 'روح اتعلم أمن سيبراني صح 📚😂'
        }), 400

    if has_path_traversal(path):
        blocked_ips.add(ip)
        blocked_info[ip] = datetime.now().isoformat()
        send_discord_alert({
            'type': '📂 محاولة Path Traversal',
            'ip': ip,
            'attempts': request_count,
            'level': 'HIGH',
            'target': path,
            'blocked': True
        })
        return jsonify({
            'error': 'محاولة Path Traversal مكتشفة',
            'message': 'ملفاتنا محمية، جرب حظك في مكان تاني 🔒'
        }), 400

    if request_count > 30:
        send_discord_alert({
            'type': '⚠️ نشاط مشبوه',
            'ip': ip,
            'attempts': request_count,
            'level': 'LOW',
            'target': path,
            'blocked': False
        })

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'healthy',
        'message': '🛡️ AMSTERDAM County - النظام يعمل بكفاءة عالية',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/security-status')
def security_status():
    return jsonify({
        'status': 'protected',
        'message': 'الموقع محمي بأحدث أنظمة الحماية',
        'features': [
            'حماية من DDoS',
            'حماية من SQL Injection',
            'حماية من XSS',
            'حماية من Path Traversal',
            'Rate Limiting متقدم',
            'تنبيهات فورية على Discord'
        ]
    })

@app.route('/api/db-status')
def db_status():
    try:
        if db_connection is None:
            connected = connect_db()
            if not connected:
                return jsonify({
                    'ok': False,
                    'db_connected': False,
                    'db_message': 'فشل الاتصال بقاعدة البيانات'
                })

        # اختبار الاتصال
        with db_connection.cursor() as cursor:
            cursor.execute('SELECT 1')

        return jsonify({
            'ok': True,
            'db_connected': True,
            'db_message': 'قاعدة البيانات متصلة بنجاح',
            'message': 'Python backend ready'
        })
    except Exception as e:
        return jsonify({
            'ok': False,
            'db_connected': False,
            'db_message': f'خطأ في الاتصال: {str(e)}'
        })

@app.route('/api/ping')
def ping():
    return jsonify({"ok": True, "message": "pong"})


@app.route('/exchange', methods=['POST'])
def exchange_code():
    '''Exchange OAuth code from frontend for a Discord access token and return user info.'''
    data = request.get_json() or {}
    code = data.get('code')
    redirect_uri = data.get('redirect_uri') or os.environ.get('DISCORD_REDIRECT_URI')

    if not code:
        return jsonify({'error': 'missing_code', 'message': 'No code provided'}), 400

    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET or not redirect_uri:
        return jsonify({'error': 'server_misconfigured', 'message': 'Discord OAuth not configured on server'}), 500

    token_url = 'https://discord.com/api/oauth2/token'
    payload = {
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': DISCORD_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri
    }

    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    try:
        resp = requests.post(token_url, data=payload, headers=headers, timeout=10)
        token_data = resp.json()
    except Exception as e:
        return jsonify({'error': 'token_request_failed', 'message': str(e)}), 502

    if 'access_token' not in token_data:
        return jsonify({'error': 'token_error', 'details': token_data}), 400

    access_token = token_data['access_token']

    # Fetch user info
    try:
        user_resp = requests.get('https://discord.com/api/users/@me', headers={'Authorization': f'Bearer {access_token}'}, timeout=10)
        user = user_resp.json()
    except Exception as e:
        return jsonify({'error': 'user_fetch_failed', 'message': str(e)}), 502

    # Optionally: persist user to DB (lightweight example)
    try:
        if connect_db():
            with db_connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS discord_users (
                        id VARCHAR(32) PRIMARY KEY,
                        username VARCHAR(100),
                        discriminator VARCHAR(10),
                        avatar VARCHAR(100),
                        locale VARCHAR(20),
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                    INSERT INTO discord_users (id, username, discriminator, avatar, locale)
                    VALUES (%s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE username=VALUES(username), discriminator=VALUES(discriminator), avatar=VALUES(avatar), locale=VALUES(locale)
                """, (user.get('id'), user.get('username'), user.get('discriminator'), user.get('avatar'), user.get('locale')))
                db_connection.commit()
    except Exception:
        # Non fatal - ignore DB errors here
        pass

    return jsonify({'user': user, 'token': token_data})


@app.route('/status/db')
def status_db():
    ok = connect_db()
    return jsonify({'status': 'connected' if ok else 'disconnected'})


@app.route('/status/discord')
def status_discord():
    '''Check whether the configured bot token is valid by calling Discord API. Does not run the bot.'''
    if not DISCORD_BOT_TOKEN:
        return jsonify({'status': 'unconfigured'})

    try:
        resp = requests.get('https://discord.com/api/users/@me', headers={'Authorization': f'Bot {DISCORD_BOT_TOKEN}'}, timeout=8)
        if resp.status_code == 200:
            return jsonify({'status': 'online'})
        else:
            return jsonify({'status': 'invalid', 'code': resp.status_code})
    except Exception:
        return jsonify({'status': 'error'})


@app.route('/config')
def config():
    '''Return minimal public configuration for frontend (no secrets).'''
    return jsonify({
        'discord_client_id': DISCORD_CLIENT_ID,
        'discord_redirect_uri': DISCORD_REDIRECT_URI
    })


@app.route('/api/metrics')
def api_metrics():
    '''Return simple metrics for dashboard: total tracked IPs, blocked count, recent requests count (last minute sample).'''
    try:
        total_tracked = len(request_tracker)
        total_blocked = len(blocked_ips)
        # total recent requests = sum of counts in request_tracker
        recent_requests = sum(len(v) for v in request_tracker.values())

        return jsonify({
            'ok': True,
            'total_tracked_ips': total_tracked,
            'total_blocked_ips': total_blocked,
            'recent_requests_last_minute': recent_requests,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})


@app.route('/api/blocked-ips')
def api_blocked_ips():
    '''Return list of blocked IPs with timestamps.'''
    try:
        data = [{'ip': ip, 'blocked_at': blocked_info.get(ip)} for ip in sorted(blocked_ips)]
        return jsonify({'ok': True, 'blocked': data})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})

# خدمة الملفات الثابتة
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == '' or '.' not in path:
        path = 'index.html'
    return send_from_directory('../', path)

if __name__ == "__main__":
    connect_db()
    app.run(host="0.0.0.0", port=5000, debug=True)


