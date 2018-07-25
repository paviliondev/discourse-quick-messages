import { createWidget } from 'discourse/widgets/widget';
import RawHtml from 'discourse/widgets/raw-html';
import { iconNode } from 'discourse-common/lib/icon-library';
import { autoUpdatingRelativeAge } from 'discourse/lib/formatter';
import { userPath } from 'discourse/lib/url';
import { h } from 'virtual-dom';

const actionDescriptionHtml = function(actionCode, createdAt, username) {
  const dt = new Date(createdAt);
  const when = autoUpdatingRelativeAge(dt, { format: 'tiny', addAgo: true });

  var who = "";
  if (username) {
    if (actionCode === "invited_group" || actionCode === "removed_group") {
      who = `<a class="mention-group" href="/groups/${username}">@${username}</a>`;
    } else {
      who = `<a class="mention" href="${userPath(username)}">@${username}</a>`;
    }
  }
  return I18n.t(`action_codes.${actionCode}`, { who, when }).htmlSafe();
};

const icons = {
  'closed.enabled': 'lock',
  'closed.disabled': 'unlock-alt',
  'autoclosed.enabled': 'lock',
  'autoclosed.disabled': 'unlock-alt',
  'archived.enabled': 'folder',
  'archived.disabled': 'folder-open',
  'pinned.enabled': 'thumb-tack',
  'pinned.disabled': 'thumb-tack unpinned',
  'pinned_globally.enabled': 'thumb-tack',
  'pinned_globally.disabled': 'thumb-tack unpinned',
  'banner.enabled': 'thumb-tack',
  'banner.disabled': 'thumb-tack unpinned',
  'visible.enabled': 'eye',
  'visible.disabled': 'eye-slash',
  'split_topic': 'sign-out',
  'invited_user': 'plus-circle',
  'invited_group': 'plus-circle',
  'user_left': 'minus-circle',
  'removed_user': 'minus-circle',
  'removed_group': 'minus-circle',
  'public_topic': 'comment',
  'private_topic': 'envelope'
};
console.log("widgets/docked-small-action");

export default createWidget('docked-small-action', {
  tagName: 'div.docked-small-action',

  html(attrs) {
    const contents = [];

    contents.push(h('div.icon', iconNode(icons[attrs.action_code] || 'exclamation')));

    contents.push(h('span', h('a.mention', { href: userPath(attrs.username) }, `@${attrs.username}`)));

    const description = actionDescriptionHtml(attrs.action_code, attrs.created_at, attrs.action_code_who);
    contents.push(new RawHtml({ html: `<span>${description}</span>` }));

    if (attrs.cooked) {
      contents.push(new RawHtml({ html: `<div class='custom-message'>${attrs.cooked}</div>` }));
    }

    return contents;
  }
});
