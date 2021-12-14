import { createWidget } from 'discourse/widgets/widget';
import PostCooked from 'discourse/widgets/post-cooked';
import DecoratorHelper from 'discourse/widgets/decorator-helper';
import { longDate } from 'discourse/lib/formatter';

class QuickPostCooked extends PostCooked {
  init() {
    const $html = $(`<div class='cooked'>${this.attrs.cooked}</div>`);
    this._insertQuoteControls($html);
    this._showLinkCounts($html);

    // removed inhttps://github.com/discourse/discourse/commit/e305365168528883872d4ce9efd109e41149ef0a
    // this._fixImageSizes($html);

    this._applySearchHighlight($html);
    return $html[0];
  }

  update(prev) {
    return this.init();
  }
}

export default createWidget('docked-post', {
  buildAttributes(attrs) {
    return {
      title: longDate(attrs.post.created_at)
    }
  },

  html(attrs) {
    const post = attrs.post;
    return new QuickPostCooked(post, new DecoratorHelper(this));
  }
});
