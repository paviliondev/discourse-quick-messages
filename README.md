# discourse-quick-messages

Adds a dropdown in the header that shows you your latest private messages and a 'chat' experience for private messages similar to Facebook Messages or Google Hangouts.

## User notes:

1. You cannot yet have multiple chats open at once. If you open a new private message topic from the messages menu, it will override any existing private message compose and message stream you have open. Multiple chats open at once may be a future feature.

2. New private messages composed from the "New Message" compose button in the messages dropdown behave like chat streams, i.e.:

    1. The topic title will be the usernames of the participants in the topic, e.g. "Bob & Mary".
    2. If the participants in the new topic match the participants in an existing topic, the existing topic will be continued rather than a new topic created.

3. Notifications about private messages will no longer appear in the notifications stream in the user menu. Whenever there is a new post in any private message topic, that topic will automatically move to the top of the message menu list. The unread private messages count will appear above the messages menu icon, rather than the user menu icon.

4. Using any compose action other than the two in the messages menu will display the normal discourse compose and should work as normal. It should be possible to transition seamlessly between the two types of compose experience.

## Technical notes:

I have tried to override as little of the existing discourse composer functionality as possible. Where I have overridden existing discourse methods I have made a note of it in the code. See in particular [here](https://github.com/angusmcleod/discourse-quick-messages/blob/master/assets/javascripts/discourse/initializers/quick-messages-edits.js.es6#L52) and [here](https://github.com/angusmcleod/discourse-quick-messages/blob/master/assets/javascripts/discourse/initializers/quick-messages-edits.js.es6#L242)

## Known issues

Please note that this modifies a relatively complex aspect of Discourse. There may be unknown issues outstanding. Please use with caution at this early stage.

1. The post button stays visible for a moment after closing the docked chat compose.

2. Various CSS issues, including the messages menu loading spinner.

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
