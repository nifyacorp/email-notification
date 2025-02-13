import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { join } from 'path';

const templates = new Map();

export async function loadTemplate(name) {
  const templatePath = join(process.cwd(), 'src', 'templates', `${name}.html`);
  const content = await readFile(templatePath, 'utf-8');
  templates.set(name, Handlebars.compile(content));
}

export async function render(name, data) {
  if (!templates.has(name)) {
    await loadTemplate(name);
  }
  
  const template = templates.get(name);
  return template(data);
}