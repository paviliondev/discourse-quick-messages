# name: discourse-quick-messages
# about: A Discourse plugin that adds a menu and a chat-like compose for private messages
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/quick.scss', :desktop

after_initialize do

  Post.register_custom_field_type('quick_message', :boolean)

  SiteSetting.class_eval do
    def self.quick_message_post_length
      quick_message_min_post_length..max_post_length
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
        max_setting = if user && user.new_user? and SiteSetting.has_setting?("rate_limit_new_user_#{limit_key}")
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

  Validators::PostValidator.class_eval do
    def stripped_length(post)
      range = if post.custom_fields['quick_message'] || private_message?(post)
        # private message
        SiteSetting.quick_message_post_length
      elsif post.is_first_post? || (post.topic.present? && post.topic.posts_count == 0)
        # creating/editing first post
        SiteSetting.first_post_length
      else
        # regular post
        SiteSetting.post_length
      end

      Validators::StrippedLengthValidator.validate(post, :raw, post.raw, range)
    end

    def unique_post_validator(post)
      return if SiteSetting.unique_posts_mins == 0
      return if post.skip_unique_check
      return if post.acting_user.staff?
      return if post.custom_fields['quick_message'] || private_message?(post)

      # If the post is empty, default to the validates_presence_of
      return if post.raw.blank?

      if post.matches_recent_post?
        post.errors.add(:raw, I18n.t(:just_posted_that))
      end
    end
  end

  require 'topic_list_item_serializer'
  class ::TopicListItemSerializer
    attributes :message_excerpt,
               :subtype

    def message_excerpt
      if object.custom_fields["quick_message"] || object.archetype == Archetype.private_message
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

    def subtype
      object.subtype
    end
  end

  TopicList.preloaded_custom_fields << "quick_message" if TopicList.respond_to? :preloaded_custom_fields
end
