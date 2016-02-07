import { url } from 'discourse/lib/computed';
import Topic from 'discourse/models/topic';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'messages-menu',
  messagesPath: url('controller.currentUser.path', '%@/messages'),
  loadingMessages: false,

  willInsertElement: function () {
    this.getMessages()
    this.$().on('click.messages-menu-new', '.new-docked-message', e => {
      this.sendAction('dockedCompose', this.get('allMessages'))
    })
    this.$().on('click.messages-menu-preview', '.message-preview', e => {
      e.preventDefault()
      Topic.find($(e.currentTarget).data('topic-id'), {}).then((topic) => {
        var replyTo = Topic.create(topic)
        this.sendAction('dockedReply', replyTo, this.get('allMessages'))
      })
    })
  },

  willDestroyElement: function() {
    this.$().off('click.messages-menu-new')
    this.$().off('click.messages-menu-preview')
  },

  getMessages: function() {
    this.set('loadingMessages', true)

    const store = this.container.lookup('store:main'),
          username = this.get('currentUser.username');

    store.findFiltered("topicList", {filter: "topics/private-messages/" + username}).then((result) => {
      var inbox = result.topics,
          inboxIds = result.topics.map(function(topic) {return topic.id});

      store.findFiltered("topicList", {filter: "topics/private-messages-sent/" + username}).then((result) => {
        var sentOnly = result.topics.filter(function(topic) {return inboxIds.indexOf(topic.id) === -1}),
            messages = inbox.concat(sentOnly);

        messages.sort(function(a, b) {
          a = new Date(a.last_posted_at);
          b = new Date(b.last_posted_at);
          return a > b ? -1 : a < b ? 1 : 0;
        });

        this.set('allMessages', messages)

        messages = messages.slice(0,7)

        messages.forEach((message, i) => {
          if (message.last_read_post_number === message.highest_post_number) {
            message.read = true
          }
        })

        this.set('loadingMessages', false)
        this.set('messages', messages)

      })
    })
  }.observes('currentUser.unread_private_messages', 'appController.newPost'),

});
