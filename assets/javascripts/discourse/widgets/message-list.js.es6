import { createWidget } from 'discourse/widgets/widget';
import { getCurrentUserMessages } from 'discourse/plugins/discourse-quick-messages/discourse/helpers/user-messages';
import { h } from 'virtual-dom';

export default createWidget('message-list', {
  tagName: 'div.message-list',
  buildKey: () => 'message-list',

  defaultState() {
    return { notifications: [], loading: false };
  },

  messagesChanged() {
    this.refreshMessages(this.state);
  },

  refreshMessages(state) {
    if (this.loading) { return; }
    state.loading = true
    getCurrentUserMessages(this).then((result) => {
      var messages = result.slice(0,7)
      messages.forEach((m, i) => {
        if (m.last_read_post_number !== m.highest_post_number) {
          m.set('unread', true)
        }
        if (m.message_excerpt) {
          m.set('excerpt', Discourse.Emoji.unescape(m.message_excerpt))
        }
        state.messages = messages
      })
      state.loading = false
      this.scheduleRerender()
    })
  },

  html(attrs, state) {
    if (!state.messages) {
      this.refreshMessages(state);
    }
    const result = [];
    if (state.loading) {
      result.push(h('div.spinner-container', h('div.spinner')));
    } else if (state.messages) {
      const messageItems = state.messages.map(m => this.attach('message-item', m));
      result.push(h('ul', [messageItems]));
    }
    return result;
  }
});
