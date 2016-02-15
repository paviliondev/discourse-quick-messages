# name: discourse-quick-messages
# about: A Discourse plugin that adds a menu and a chat-like compose for private messages
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/quick-messages.scss', :desktop

after_initialize do

  ## Add the first 200 characters of the latest post as an 'excerpt' to all private messages

  require 'listable_topic_serializer'
  class ::ListableTopicSerializer
    def excerpt
      if object.archetype == Archetype.private_message
        cooked = Post.where(topic_id: object.id, post_number: object.highest_post_number).pluck('cooked')
        PrettyText.excerpt(cooked[0], 200, {})
      else
        object.excerpt
      end
    end
    def include_excerpt?
      pinned || object.archetype == Archetype.private_message
    end
  end

end
