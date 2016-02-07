# discourse-quick-messages

## Installation

To install using docker, add the following to your app.yml in the plugins section:

```
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - mkdir -p plugins
          - git clone https://github.com/angusmcleod/discourse-quick-messages.git
```

and rebuild docker via

```
cd /var/discourse
./launcher rebuild app
```

## Known issues
