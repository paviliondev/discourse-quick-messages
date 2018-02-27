import { createWidget } from 'discourse/widgets/widget';
import PostCooked from 'discourse/widgets/post-cooked';
import DecoratorHelper from 'discourse/widgets/decorator-helper';

export default createWidget('docked-post', {
  html(attrs) {
    return new PostCooked(attrs, new DecoratorHelper(this));
  }
});
