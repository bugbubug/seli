{
  "name": "seli-local",
  "interface": {
    "displayName": "Seli Local Plugins"
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
