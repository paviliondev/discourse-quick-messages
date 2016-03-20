import { url } from 'discourse/lib/computed';
import Topic from 'discourse/models/topic';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'messages-menu',
  messagesPath: url('controller.currentUser.path', '%@/messages'),
  loadingTopicList: false,
  dockedTopics: [],
  topics: [],
  topicList: [],

  didInsertElement: function () {
    this.getTopics()
    this.$().on('click.messages-menu-new', '.new-docked-message', e => {
      var current = this.get('docked'),
          empty = { id: null, topic: null };
      this.set('docked', current.push(empty))
    })
    this.$().on('click.messages-menu-preview', '.message-preview', e => {
      var topicId = $(e.currentTarget).data('topic-id'),
          dockedTopics = this.get('dockedTopics');
      dockedTopics.pushObject(topicId)
      this.set('dockedTopics', dockedTopics)
    })
  },

  willDestroyElement: function() {
    this.$().off('click.messages-menu-new')
    this.$().off('click.messages-menu-preview')
  },

  getTopics: function() {
    this.set('loadingTopicList', true)
    const store = this.container.lookup('store:main'),
          username = this.get('currentUser.username');
    store.findFiltered("topicList", {filter: "topics/private-messages/" + username}).then((result) => {
      var inbox = result.topics,
          inboxIds = result.topics.map(function(topic) {return topic.id});
      store.findFiltered("topicList", {filter: "topics/private-messages-sent/" + username}).then((result) => {
        var sentOnly = result.topics.filter(function(topic) {return inboxIds.indexOf(topic.id) === -1}),
            topicList = inbox.concat(sentOnly);
        topicList.sort(function(a, b) {
          a = new Date(a.last_posted_at);
          b = new Date(b.last_posted_at);
          return a > b ? -1 : a < b ? 1 : 0;
        });
        this.set('allTopicList', topicList)
        topicList = topicList.slice(0,7)
        var topics = this.get('topics')
        topicList.forEach((listItem, i) => {
          if (listItem.last_read_post_number === listItem.highest_post_number) {
            listItem.read = true
          }
          if (listItem.excerpt) {
            listItem.preview = Discourse.Emoji.unescape(listItem.excerpt)
          }
          this.set('topicList', topicList)
        })
        this.set('loadingTopicList', false)
      })
    })
  }.observes('currentUser.unread_private_messages', 'currentUser.topic_count', 'currentUser.reply_count'),

  actions: {
    showQuickUpload(e) {
      this.sendAction('showQuickUpload', e)
    }
  }

});
