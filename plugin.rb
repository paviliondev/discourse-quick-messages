# name: discourse-quick-messages
# about: A Discourse plugin that adds a menu and a chat-like compose for private messages
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/common/quick_menu.scss'
register_asset 'stylesheets/common/quick_composer.scss'
register_asset 'stylesheets/mobile/quick_mobile.scss', :mobile

after_initialize do

  Post.register_custom_field_type('quick_message', :boolean)
  PostRevisor.track_topic_field(:custom_fields)
  
  DiscoursePluginRegistry.serialized_current_user_fields << "show_quick_message"
  User.register_custom_field_type("show_quick_message", :boolean)
  add_to_serializer(:current_user, :show_quick_message) { object.custom_fields["show_quick_message"] }

  SiteSetting.class_eval do
    def self.min_private_message_post_length
      quick_message_min_post_length
    end

    def self.private_message_post_length
      quick_message_min_post_length..max_post_length
    end
  end

  Validators::PostValidator.class_eval do
    def private_message?(post)
      post.topic.try(:private_message?) || post.custom_fields['quick_message']
    end
  end

  Post.class_eval do
    def default_rate_limiter
      return @rate_limiter if @rate_limiter.present?
      if custom_fields["quick_message"] || archetype == Archetype.private_message
        limit_key = "create_quick_message"
        max_setting = SiteSetting.send("quick_message_rate_limit_create")
      else
        limit_key = "create_#{self.class.name.underscore}"
        max_setting = if user && user.new_user? && SiteSetting.has_setting?("rate_limit_new_user_#{limit_key}")
          SiteSetting.send("rate_limit_new_user_#{limit_key}")
        else
          SiteSetting.send("rate_limit_#{limit_key}")
        end
      end
      @rate_limiter = RateLimiter.new(user, limit_key, 1, max_setting)
    end

    def limit_posts_per_day
      unless custom_fields["quick_message"] || archetype == Archetype.private_message
        if user && user.new_user_posting_on_first_day? && post_number && post_number > 1
          RateLimiter.new(user, "first-day-replies-per-day", SiteSetting.max_replies_in_first_day, 1.day.to_i)
        end
      end
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
              t.subtype = :subtype AND
              n.notification_type = :type AND
              n.user_id = :user_id AND
              NOT read"

          User.exec_sql(sql, user_id: id,
                             subtype: TopicSubtype.user_to_user,
                             type:  Notification.types[:private_message])
            .getvalue(0, 0).to_i
        end
    end
  end

  require 'topic_list_item_serializer'
  class ::TopicListItemSerializer
    attributes :message_excerpt, :subtype

    def message_excerpt
      if object.custom_fields["quick_message"] || object.archetype == Archetype.private_message
        raw = Post.where(topic_id: object.id, post_number: object.highest_post_number).pluck('raw')[0]
        raw.gsub!(/(\!\[)(.*?)\)/, "<i class='fa fa-picture-o'></i>")
        raw.truncate(150)
      else
        return false
      end
    end

    def include_message_excerpt?
      !!message_excerpt
    end

    def subtype
      object.subtype
    end
  end

  TopicList.preloaded_custom_fields << "quick_message" if TopicList.respond_to? :preloaded_custom_fields
end
