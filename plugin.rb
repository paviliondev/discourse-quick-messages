# name: discourse-quick-messages
# about: A Discourse plugin that adds a menu and a chat-like compose for private messages
# version: 0.1
# authors: Angus McLeod
# url: https://github.com/angusmcleod/discourse-quick-messages

register_asset 'stylesheets/common/quick_menu.scss'
register_asset 'stylesheets/common/quick_composer.scss'
register_asset 'stylesheets/mobile/quick_mobile.scss', :mobile
require_relative 'lib/setting_quick_messages_badge'

if respond_to?(:register_svg_icon)
  register_svg_icon "angle-up"
  register_svg_icon "angle-down"
  register_svg_icon "external-link"
  register_svg_icon "times"
end

enabled_site_setting :quick_message_enabled

after_initialize do

  Post.register_custom_field_type('quick_message', :boolean)
  PostRevisor.track_topic_field(:custom_fields)

  DiscoursePluginRegistry.serialized_current_user_fields << "show_quick_messages"
  DiscoursePluginRegistry.serialized_current_user_fields << "quick_messages_access"
  User.register_custom_field_type("show_quick_messages", :boolean)
  User.register_custom_field_type("quick_messages_access", :boolean)
  add_to_serializer(:current_user, :show_quick_messages) { object.show_quick_messages }
  add_to_serializer(:current_user, :quick_messages_access) { object.quick_messages_access }
  register_editable_user_custom_field :show_quick_messages if defined? register_editable_user_custom_field
  register_editable_user_custom_field :quick_messages_access if defined? register_editable_user_custom_field

  SiteSetting.class_eval do
    def self.min_private_message_post_length
      quick_message_min_post_length
    end

    def self.private_message_post_length
      quick_message_min_post_length..max_post_length
    end
  end
  
  (defined?(PostValidator) == 'constant' ? PostValidator : Validators::PostValidator).class_eval do
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

  class ::User
    def show_quick_messages
      return false unless SiteSetting.quick_message_enabled
      return false unless quick_messages_access
      !SiteSetting.quick_message_user_preference || ActiveModel::Type::Boolean.new.cast(custom_fields['show_quick_messages'])
    end

    def quick_messages_access
      SiteSetting.quick_message_required_badge == 0 || self.badge_ids.include?(SiteSetting.quick_message_required_badge)
    end
  end

  module UserUnreadPrivateMessagesExtension
    def unread_private_messages
      if self.show_quick_messages
        @unread_pms ||=
          begin
            # perf critical, much more efficient than AR
            sql = <<~SQL
                SELECT COUNT(*)
                  FROM notifications n
            LEFT JOIN topics t ON t.id = n.topic_id
                WHERE t.deleted_at IS NULL
                  AND t.subtype = :subtype
                  AND n.notification_type = :type
                  AND n.user_id = :user_id
                  AND NOT read
            SQL

            DB.query_single(sql,
              user_id: id,
              subtype: TopicSubtype.user_to_user,
              type: Notification.types[:private_message]
            )[0].to_i
          end
      else
        super
      end
    end
  end

  require_dependency 'user'
  class ::User
    prepend UserUnreadPrivateMessagesExtension
  end

  require_dependency 'topic_list_item_serializer'
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

  require_dependency 'post_creator'

  class ::PostCreator

    # The valid? function stops us from adding posts to existing topics.
    # We can overwrite it here without the logic that blocks us.
    def valid?
    @topic = nil
    @post = nil

    if @user.suspended? && !skip_validations?
      errors.add(:base, I18n.t(:user_is_suspended))
      return false
    end

    if @opts[:target_usernames].present? && !skip_validations? && !@user.staff?
      names = @opts[:target_usernames].split(',')

      # Make sure max_allowed_message_recipients setting is respected
      max_allowed_message_recipients = SiteSetting.max_allowed_message_recipients

      if names.length > max_allowed_message_recipients
        errors.add(
          :base,
          I18n.t(:max_pm_recipients, recipients_limit: max_allowed_message_recipients)
        )

        return false
      end

      # Make sure none of the users have muted the creator
      users = User.where(username: names).pluck(:id, :username).to_h

      User
        .joins("LEFT JOIN user_options ON user_options.user_id = users.id")
        .joins("LEFT JOIN muted_users ON muted_users.user_id = users.id AND muted_users.muted_user_id = #{@user.id.to_i}")
        .joins("LEFT JOIN ignored_users ON ignored_users.user_id = users.id AND ignored_users.ignored_user_id = #{@user.id.to_i}")
        .where("user_options.user_id IS NOT NULL")
        .where("
          (user_options.user_id IN (:user_ids) AND NOT user_options.allow_private_messages) OR
          muted_users.user_id IN (:user_ids) OR
          ignored_users.user_id IN (:user_ids)
        ", user_ids: users.keys)
        .pluck(:id).each do |m|

        errors.add(:base, I18n.t(:not_accepting_pms, username: users[m]))
      end

      return false if errors[:base].present?
    end

    if new_topic?
      topic_creator = TopicCreator.new(@user, guardian, @opts)
      return false unless skip_validations? || validate_child(topic_creator)
    else
      @topic = Topic.find_by(id: @opts[:topic_id])


      unless @topic.present? && (@opts[:skip_guardian] || guardian.can_create?(Post, @topic))
        errors.add(:base, I18n.t(:topic_not_found))
        return false
      end
    end

    setup_post

    return true if skip_validations?

    if @post.has_host_spam?
      @spam = true
      errors.add(:base, I18n.t(:spamming_host))
      return false
    end

    DiscourseEvent.trigger :before_create_post, @post
    DiscourseEvent.trigger :validate_post, @post

    post_validator = PostValidator.new(skip_topic: true)
    post_validator.validate(@post)

    valid = @post.errors.blank?
    add_errors_from(@post) unless valid
    valid
    end
  end
end
