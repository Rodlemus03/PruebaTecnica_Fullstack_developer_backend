const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(
  process.env.FRONTEND_DIR || path.join(backendDir, '..', 'PruebaTecnica_Fullstack_developer_frontend'),
);
const frontendRepo = 'https://github.com/Rodlemus03/PruebaTecnica_Fullstack_developer_frontend.git';
const isWindows = process.platform === 'win32';
const children = [];

function fail(message) {
  console.error(`\nNo se pudo iniciar el proyecto: ${message}`);
  process.exit(1);
}

function step(message) {
  console.log(`\n> ${message}`);
}

function run(command, args, { cwd = backendDir, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: isWindows && command === 'npm',
  });
  return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}` };
}

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 22)) {
    fail(`se necesita Node.js 22.22 o superior y tienes ${process.version}. Descárgalo en https://nodejs.org`);
  }
}

function ensureFrontend() {
  if (fs.existsSync(path.join(frontendDir, 'package.json'))) return;
  step(`Descargando el frontend en ${frontendDir}`);
  if (!run('git', ['--version'], { capture: true }).ok) {
    fail(`no encontré el frontend en ${frontendDir} y git no está instalado para descargarlo. Clona ${frontendRepo} en esa carpeta.`);
  }
  if (!run('git', ['clone', frontendRepo, frontendDir]).ok) {
    fail('no se pudo clonar el repositorio del frontend.');
  }
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    rl._writeToOutput = () => {};
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function ensureEnv() {
  const envFile = path.join(backendDir, '.env');
  if (fs.existsSync(envFile)) return;

  let password = process.env.DB_PASSWORD;
  if (password === undefined) {
    if (!process.stdin.isTTY) {
      fail('falta el archivo .env. Copia .env.example como .env y escribe la contraseña de PostgreSQL.');
    }
    password = await askHidden('Contraseña del usuario postgres de PostgreSQL: ');
  }

  const quoted = password.includes("'") ? `"${password}"` : `'${password}'`;
  const template = fs.readFileSync(path.join(backendDir, '.env.example'), 'utf8');
  fs.writeFileSync(envFile, template.replace(/^DB_PASSWORD=.*$/m, () => `DB_PASSWORD=${quoted}`));
  console.log('Se creó el archivo .env. Si tu PostgreSQL usa otro usuario, servidor o puerto, edítalo y vuelve a ejecutar.');
}

function installDependencies(dir, name) {
  if (fs.existsSync(path.join(dir, 'node_modules'))) return;
  step(`Instalando dependencias del ${name}`);
  if (!run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir }).ok) {
    fail(`falló la instalación de dependencias del ${name}.`);
  }
}

function prepareDatabase() {
  step('Preparando la base de datos');
  const created = run('npm', ['run', 'db:create'], { capture: true });
  const migrated = run('npm', ['run', 'db:migrate'], { capture: true });
  if (!migrated.ok) {
    console.error(created.output);
    console.error(migrated.output);
    fail('revisa que PostgreSQL esté encendido y que los datos de conexión en .env sean correctos.');
  }
  if (!run('npm', ['run', 'db:import', '--', '--if-empty']).ok) {
    fail('no se pudo importar el Excel.');
  }
}

function start(command, args, options) {
  const child = spawn(command, args, { stdio: 'inherit', shell: isWindows && command === 'npm', ...options });
  children.push(child);
  return child;
}

function stopAll(code = 0) {
  children.forEach((child) => {
    if (child.exitCode !== null) return;
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill();
    }
  });
  process.exit(code);
}

async function waitForApi(port, api) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (api.exitCode !== null) return false;
    const healthy = await fetch(`http://localhost:${port}/api/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (healthy) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  checkNode();
  ensureFrontend();
  await ensureEnv();
  installDependencies(backendDir, 'backend');
  installDependencies(frontendDir, 'frontend');
  prepareDatabase();

  require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env'), quiet: true });
  const port = Number(process.env.PORT) || 3000;

  step(`Iniciando la API en http://localhost:${port}/api`);
  const api = start(process.execPath, ['src/server.js'], { cwd: backendDir });
  if (!(await waitForApi(port, api))) {
    console.error(`\nNo se pudo iniciar el proyecto: la API no respondió en el puerto ${port}.`);
    stopAll(1);
  }

  const canOpenBrowser = isWindows || process.platform === 'darwin' || process.env.DISPLAY || process.env.WAYLAND_DISPLAY;
  step('Iniciando la aplicación en http://localhost:5173 (Ctrl+C para detener todo)');
  const web = start('npm', ['run', 'dev', ...(canOpenBrowser ? ['--', '--open'] : [])], {
    cwd: frontendDir,
    env: { ...process.env, VITE_API_URL: `http://localhost:${port}/api` },
  });

  api.on('exit', () => stopAll(1));
  web.on('exit', (code) => stopAll(code ?? 0));
  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
}

main();
