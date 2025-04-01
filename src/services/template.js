import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', function(date) {
  if (!date) return '';
  return new Date(date).toLocaleString();
});

// Format time elapsed since the given date
Handlebars.registerHelper('timeAgo', function(date) {
  if (!date) return '';
  
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  
  if (seconds < 60) {
    return 'just now';
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
});

// Format a date in a more readable way
Handlebars.registerHelper('formattedDate', function(date) {
  if (!date) return '';
  const d = new Date(date);
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return d.toLocaleDateString(undefined, options);
});

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