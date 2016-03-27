export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  test: function() {
    var imgs = this.$('img')
    if (imgs.length) {
      imgs.each(function(i){
        $(this).one("load", function() {
          $('.docked-composer-top').scrollTop($('.docked-post-stream').height())
        }).each(function() {
          if(this.complete) $(this).load();
        });
      })
    }
  }.on('didInsertElement'),

})
