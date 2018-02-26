import { default as computed, on } from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  @computed('post.yours')
  contentClass(yours) {
    return yours ? 'yours' : '';
  },

  @on('didInsertElement')
  testImages() {
    let imgs = this.$('img');
    if (imgs.length) {
      imgs.each(() => {
        $(this).one("load", () => {
          Ember.run.scheduleOnce('afterRender', () => this.sendAction('scrollPoststream'));
        }).each(function() {
          if(this.complete) $(this).load();
        });
      });
    }
  }
});
