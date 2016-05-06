export function getCurrentUserMessages(context) {
  const store = context.container.lookup('store:main'),
        username = context.currentUser.get('username');
  return store.findFiltered("topicList", {filter: "topics/private-messages/" + username}).then((result) => {
    var inbox = result.topics,
        inboxIds = result.topics.map(function(topic) {return topic.id});
    return store.findFiltered("topicList", {filter: "topics/private-messages-sent/" + username}).then((result) => {
      var sentOnly = result.topics.filter(function(topic) {return inboxIds.indexOf(topic.id) === -1}),
          messages = inbox.concat(sentOnly);
      messages.sort(function(a, b) {
        a = new Date(a.last_posted_at);
        b = new Date(b.last_posted_at);
        return a > b ? -1 : a < b ? 1 : 0;
      });
      return messages
    })
  })
}
