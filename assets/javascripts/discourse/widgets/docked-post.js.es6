import { createWidget } from 'discourse/widgets/widget';
import PostCooked from 'discourse/widgets/post-cooked';
import DecoratorHelper from 'discourse/widgets/decorator-helper';
import { longDate } from 'discourse/lib/formatter';

class QuickPostCooked extends PostCooked {
  // Ensure staged posts get updated;
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
