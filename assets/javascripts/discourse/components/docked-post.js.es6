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
      imgs.each(function(){
        $(this).one("load", function() {
          $('.docked-composer-top').scrollTop($('.docked-post-stream').height());
        }).each(function() {
          if(this.complete) $(this).load();
        });
      });
    }
  }
});
