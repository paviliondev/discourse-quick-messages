import { createWidget } from 'discourse/widgets/widget';
import PostCooked from 'discourse/widgets/post-cooked';
import DecoratorHelper from 'discourse/widgets/decorator-helper';

class QuickPostCooked extends PostCooked {
  // Ensure staged posts get updated;
  update(prev) {
    return this.init();
  }
}

export default createWidget('docked-post', {
  html(attrs) {
    const post = attrs.post;
    return new QuickPostCooked(post, new DecoratorHelper(this));
  }
});
