import { url } from 'discourse/lib/computed';
import Topic from 'discourse/models/topic';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'messages-menu',
  messagesPath: url('controller.currentUser.path', '%@/messages'),
  loadingTopicList: false,
  docked: Ember.A(),
  topicList: [],

  didInsertElement: function () {
    this.getTopics()
    this.$().on('click.messages-menu-new', '.new-docked-message', e => {
      this.addToDocked('new')
    })
    this.$().on('click.messages-menu-preview', '.message-preview', e => {
      this.addToDocked($(e.currentTarget).data('topic-id'))
    })
    this.setMaxIndex()
    $(window).on('resize', Ember.run.bind(this, this.setMaxIndex))
  },

  willDestroyElement: function() {
    this.$().off('click.messages-menu-new')
    this.$().off('click.messages-menu-preview')
    $(window).off('resize', Ember.run.bind(this, this.setMaxIndex))
  },

  setMaxIndex: function() {
    this.set('maxIndex', (Math.floor(($(window).width() - 390) / 340)) - 1)
  },

  addToDocked: function(id) {
    var docked = this.get('docked');
    if (docked.contains(id)) {return}
    var max = this.get('maxIndex');
    if (docked.length > max) {
      docked.insertAt(max, id)
    } else {
      docked.pushObject(id)
    }
    this.set('docked', docked)
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
        this.set('messages', topicList)
        topicList = topicList.slice(0,7)
        topicList.forEach((listItem, i) => {
          if (listItem.last_read_post_number !== listItem.highest_post_number) {
            listItem['unread'] = true
          }
          if (listItem.excerpt) {
            listItem['preview'] = Discourse.Emoji.unescape(listItem.excerpt)
          }
          this.set('topicList', topicList)
        })
        this.set('loadingTopicList', false)
      })
    })
  }.observes('currentUser.unread_private_messages', 'currentUser.topic_count', 'currentUser.reply_count'),

  actions: {

    removeDocked(index) {
      var docked = this.get('docked');
      docked.removeAt(index)
      this.set('docked', docked)
    },
    
    onScreen(index) {
      var docked = this.get('docked');
      var max = this.get('maxIndex'),
          item = docked.slice(index, index + 1);
      docked.removeAt(index)
      docked.insertAt(max, item[0])
      this.set('docked', docked)
    }
  }

});
