export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post-stream',

  /*'discourse/lib/screen-track' is a singleton.
  Using it interferes with the tracking of topics.
  So I have made my own rudimentary tracker. */

  dockedScreenTrack: function() {
    var topic = this.get('topic')
    if (!topic) {return}
    var lastRead = topic.last_read_post_number,
        highest = topic.highest_post_number;
    if (lastRead === highest) {return}
    this.container.lookup('topic-tracking-state:main').updateSeen(topic.id, highest)
    var newTimings = {};
    for (var p = lastRead + 1; p <= highest; p++) {
      newTimings[p] = 3000
    }
    Discourse.ajax('/topics/timings', {
      data: {
        timings: newTimings,
        topic_time: 3000,
        topic_id: topic.id
      },
      cache: false,
      type: 'POST',
      headers: {
        'X-SILENCE-LOGGER': 'true'
      }
    })
  }.observes('topic').on('didInsertElement')

})
