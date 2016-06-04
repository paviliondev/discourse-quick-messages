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
        excerpt.gsub!(/(\[#{I18n.t 'excerpt_image'}\])/, "<i class='fa fa-picture-o'></i>") if excerpt
        excerpt
      else
        return false
      end
    end

    def include_message_excerpt?
      !!message_excerpt
    end
  end

  User.class_eval do

    def unread_private_messages
      @unread_pms ||=
        begin
          # perf critical, much more efficient than AR
          sql = "
             SELECT COUNT(*) FROM notifications n
             LEFT JOIN topics t ON n.topic_id = t.id
             WHERE
              t.deleted_at IS NULL AND
              n.notification_type = :type AND
              n.user_id = :user_id AND
              t.user_id <> #{Discourse.system_user.id} AND
              NOT read"

          User.exec_sql(sql, user_id: id,
                             type:  Notification.types[:private_message]
                             )
              .getvalue(0,0).to_i
        end
    end

    def unread_notifications
      @unread_notifications ||=
        begin
          # perf critical, much more efficient than AR
          sql = "
             SELECT COUNT(*) FROM notifications n
             LEFT JOIN topics t ON n.topic_id = t.id
             WHERE
              t.deleted_at IS NULL AND
              (CASE WHEN t.user_id <> #{Discourse.system_user.id} THEN n.notification_type <> :pm ELSE TRUE END) AND
              n.user_id = :user_id AND
              NOT read AND
              n.id > :seen_notification_id"

          User.exec_sql(sql, user_id: id,
                             seen_notification_id: seen_notification_id,
                             pm:  Notification.types[:private_message])
              .getvalue(0,0).to_i
        end
    end

  end
end
