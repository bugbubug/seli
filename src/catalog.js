const fs = require('fs');
const path = require('path');
const { readJson } = require('./utils');

const managerRoot = path.resolve(__dirname, '..');

function catalogPath(...segments) {
  return path.join(managerRoot, 'catalog', ...segments);
}

function templatePath(...segments) {
  return path.join(managerRoot, 'templates', ...segments);
}

function readTemplate(...segments) {
  return fs.readFileSync(templatePath(...segments), 'utf8');
}

function loadProfile(profileId) {
  return readJson(catalogPath('profiles', `${profileId}.json`));
}

function loadProvider(providerId) {
  return readJson(catalogPath('providers', `${providerId}.json`));
}

function loadSystem(systemId) {
  return readJson(catalogPath('system', `${systemId}.json`));
}

module.exports = {
  loadProfile,
  loadProvider,
  loadSystem,
  managerRoot,
  readTemplate
};
