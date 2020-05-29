import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';
import { avatarImg } from 'discourse/widgets/post';
import I18n from "I18n";

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
                                  username: p.user.username });
    });

    let contents = [
          h('ul', h('li', participants)),
          attrs.get('excerpt')
        ];

    if (attrs.get('unread')) {
      contents.push(h('div', {className: 'new-count'}, `${attrs.get('newCount')} ${I18n.t(`new_item`)}` ));
    }

    return h('a', h('div.item-contents', contents));
  },

  click() {
    this.attrs.set('unread', false);
    const id = this.attrs.id;
    this.sendWidgetAction('addToDocked', id);
  }
});
