import os
import sqlite3
import time
from flask import Flask, request, g, render_template_string, make_response, send_from_directory, redirect, url_for
from jinja2 import Template

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'vuln.db')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

app = Flask(__name__)
app.secret_key = 'insecure-dev-secret'

# --- Database helpers ---

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        # Register a sleep function so time-based SQL payloads can be demonstrated
        def _sleep(sec):
            try:
                sec = int(sec)
            except Exception:
                sec = 0
            time.sleep(sec)
            return 1
        db.create_function('sleep', 1, _sleep)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# --- Initialization ---

def init_db():
    db = sqlite3.connect(DB_PATH)
    cur = db.cursor()
    # Simple users table (no hashing intentionally)
    cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
    ''')
    # Sample items to search
    cur.execute('''
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT
    )
    ''')
    # Insert sample data if empty
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO users (username, password) VALUES ('admin', 'adminpass')")
        cur.execute("INSERT INTO users (username, password) VALUES ('alice', 'alicepass')")
    cur.execute("SELECT COUNT(*) FROM items")
    if cur.fetchone()[0] == 0:
        cur.executemany("INSERT INTO items (name) VALUES (?)", [('foo',), ('bar',), ('public',)])
    db.commit()
    db.close()

if not os.path.exists(DB_PATH):
    init_db()

# --- Routes ---

@app.route('/')
def index():
    return '<h2>Vulnerable Test Site (Revulnera)</h2><ul>' + \
        '<li><a href="/login">Login</a></li>' + \
        '<li><a href="/register">Register</a></li>' + \
        '<li><a href="/vuln_sql?q=foo">SQL demo</a></li>' + \
        '<li><a href="/template_render?input={{7*7}}">Template render demo</a></li>' + \
        '<li><a href="/.env">/.env (exposed)</a></li>' + \
        '<li><a href="/.git/config">/.git/config (exposed)</a></li>' + \
        '</ul>'

# Vulnerable login page: returns different messages to enable username enumeration
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '')
        password = request.form.get('password', '')
        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT password FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
        if not row:
            # Intentionally revealing message
            return 'User not found', 200
        if row['password'] != password:
            # Intentionally different message
            return 'Invalid password for user', 200
        # Create an insecure session cookie without HttpOnly/SameSite
        resp = make_response('Welcome, ' + username)
        resp.set_cookie('sessionid', 'insecure-session-' + username, httponly=False)
        return resp
    return '''
    <form method="post">
      <input name="username" placeholder="username" />
      <input name="password" placeholder="password" />
      <button>Login</button>
    </form>
    '''

# Vulnerable registration: accepts weak passwords
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        db = get_db()
        cur = db.cursor()
        try:
            cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            db.commit()
            return 'Registered', 201
        except Exception as e:
            return f'Error: {e}', 400
    return '''
    <form method="post">
      <input name="username" placeholder="username" />
      <input name="password" placeholder="password" />
      <button>Register</button>
    </form>
    '''

# SQL-injection-vulnerable endpoint (unsafe string interpolation)
@app.route('/vuln_sql')
def vuln_sql():
    q = request.args.get('q', '')
    db = get_db()
    cur = db.cursor()
    # Intentionally vulnerable construction - DO NOT COPY IN PROD
    try:
        sql = f"SELECT id, name FROM items WHERE name = '{q}' LIMIT 10;"
        cur.execute(sql)
        rows = cur.fetchall()
        if not rows:
            return 'No results', 200
        return '<br>'.join([f"{r['id']} - {r['name']}" for r in rows])
    except Exception as e:
        # Return error details to simulate error disclosure
        return f'Error: {e}', 500

# Template rendering demonstration (Jinja2 template injection)
@app.route('/template_render')
def template_render():
    inp = request.args.get('input', '')
    try:
        # Render user input as Jinja template (unsafe by design)
        t = Template(inp)
        out = t.render()
        return f'Rendered: {out}'
    except Exception as e:
        return f'Template error: {e}', 500

# Expose .env file intentionally
@app.route('/.env')
def exposed_env():
    path = os.path.join(STATIC_DIR, '.env')
    if os.path.exists(path):
        return send_from_directory(STATIC_DIR, '.env')
    return 'No .env present', 404

# Expose .git config intentionally
@app.route('/.git/<path:filename>')
def git_file(filename):
    dir_path = os.path.join(STATIC_DIR, '.git')
    return send_from_directory(dir_path, filename)

# Admin panel (unprotected deliberately)
@app.route('/admin/')
def admin_panel():
    return '<h3>Admin Panel - No Auth (deliberate)</h3>'

# Directory listing simulation for /uploads/
@app.route('/uploads/<path:filename>')
def uploads(filename):
    uploads_dir = os.path.join(STATIC_DIR, 'uploads')
    return send_from_directory(uploads_dir, filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80, debug=True)
