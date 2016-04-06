# name: discourse-quick-messages
# about: A Discourse plugin that adds a menu and a chat-like compose for private messages
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/quick.scss', :desktop

after_initialize do

  ## Add the first 200 characters of the latest post as an 'excerpt' to all private messages

  require 'topic_list_item_serializer'
  class ::TopicListItemSerializer
    attributes :message_excerpt

    def message_excerpt
      if object.archetype == Archetype.private_message
        cooked = Post.where(topic_id: object.id, post_number: object.highest_post_number).pluck('cooked')
        excerpt = PrettyText.excerpt(cooked[0], 200, keep_emoji_images: true)
        excerpt.gsub!(/(\[image\])/, "<i class='fa fa-picture-o'></i>") if excerpt
        excerpt
      else
        return false
      end
    end

    def include_message_excerpt?
      !!message_excerpt
    end
  end
end
