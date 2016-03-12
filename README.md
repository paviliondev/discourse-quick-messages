# discourse-quick-messages

Adds a dropdown in the header that shows you your latest private messages and a 'chat' experience for private messages similar to Facebook Messages or Google Hangouts. [Read more about this plugin on Discourse Meta](https://meta.discourse.org/t/quick-messages-plugin/39188).

![image1](https://cloud.githubusercontent.com/assets/5931623/12876256/30c43b8a-cdcc-11e5-897d-d796279c8029.png)  
![image2](https://cloud.githubusercontent.com/assets/5931623/12876261/5c3fd58a-cdcc-11e5-9d6c-02fb748fa869.png)

## User notes:

1. If you open a new private message topic from the messages menu, it will override any existing private message compose and message stream you have open. Multiple chats open at once may be a future feature.

2. New private messages composed from the "New Message" compose button in the messages dropdown behave like chat streams, i.e.:

    1. The topic title will be the usernames of the participants in the topic, e.g. "Bob & Mary".
    2. If the participants in the new topic match the participants in an existing topic, the existing topic will be continued rather than a new topic created.

3. Notifications about private messages will no longer appear in the notifications stream in the user menu. Whenever there is a new post in any private message topic, that topic will automatically move to the top of the message menu list. The unread private messages count will appear above the messages menu icon, rather than the user menu icon.

4. Using any compose action other than the two in the messages menu will display the normal discourse compose and should work as normal. It should be possible to transition seamlessly between the two types of compose experience.

## Technical notes:

I have tried to override as little of the existing discourse composer functionality as possible. Where I have overridden existing discourse methods I have made a note of it in the code. See in particular [here](https://github.com/angusmcleod/discourse-quick-messages/blob/master/assets/javascripts/discourse/initializers/quick-messages-edits.js.es6#L52) and [here](https://github.com/angusmcleod/discourse-quick-messages/blob/master/assets/javascripts/discourse/initializers/quick-messages-edits.js.es6#L242)

## To do

1. Allow the user to have more than one quick message compose open at once.

2. Add a "Mark All Read" button to the messages menu that marks all your messages read.

3. Improve the quick message compose experience so that:

    1. Text never overlaps with the buttons
    2. The compose window increases in size instead of being scrollable.
    3. A user can send a 'Like' as a response (perhaps).

4. Performance. Make the posting of messages even quicker.

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
