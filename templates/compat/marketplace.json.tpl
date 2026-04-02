{
  "name": "ai-tool-init-local",
  "interface": {
    "displayName": "AI Tool Init Local Plugins"
  },
  "plugins": [
    {
      "name": "{{pluginId}}",
      "source": {
        "source": "local",
        "path": "./plugins/{{pluginId}}"
      },
      "policy": {
        "installation": "INSTALLED_BY_DEFAULT",
        "authentication": "ON_INSTALL"
      },
      "category": "Engineering"
    }
  ]
}
