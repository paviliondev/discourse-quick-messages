require_dependency 'enum_site_setting'

# Adds an Enum type used in the Admin to select a badge by name.
# Examples see: https://github.com/discourse/discourse/blob/master/config/site_settings.yml

class SettingQuickMessagesBadge < EnumSiteSetting
  def self.valid_value?(any)
    true
  end
  
  def self.values
    @values ||= begin
      @values = Badge.where(enabled: true).map{ |b| { name: b.name, value: b.id } }
      @values.unshift(name: 'None', value: 0)
    end
  end

  def self.translate_names?
    false
  end
end