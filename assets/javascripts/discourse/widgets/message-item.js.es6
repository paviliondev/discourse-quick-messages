import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';
import { avatarImg } from 'discourse/widgets/post';

createWidget('message-item', {
  tagName: 'li.message-item',

  buildClasses(attrs) {
    const classNames = [];
    if (attrs.get('unread')) { classNames.push('unread'); }
    return classNames;
  },


  html(attrs) {
    const participants = attrs.participants.map(p => {
      return avatarImg('small', { template: p.user.avatar_template,
                                  username: p.user.username })
    });

    let contents = [
          h('ul', h('li', participants)),
          h('div', { className: 'message-excerpt'}, attrs.get('excerpt'))
        ]

    console.log(attrs.get('unreadCount'))
    if (attrs.get('unread')) {
      contents.push(h('div', { className: 'badge-notification' }, attrs.get('unreadCount')))
    }

    return h('a', h('div.item-contents', contents))
  },

  click(e) {
    this.attrs.set('unread', false);
    const id = this.attrs.id;
    this.sendWidgetAction('addToDocked', id)
  }
});
