/**
 * @class Ext.ux.grid.RowEditor.DisplayField
 * @extends Ext.form.Field
 * Modification of the Ext.form.DisplayField, suitable for use with a RowEditor.
 * This DisplayField maintains its value separately from its presentation, meaning we can
 * continue to use a Column's renderer to preserve how the field looks when editing a row.
 */
Ext.ux.grid.RowEditor.DisplayField = Ext.extend(Ext.form.DisplayField, {
  /**
   * @property displayValue
   * @type String
   * The string to display instead of the actual value
   */
  displayValue: undefined,
  
  /**
   * Sets the field's display value and updates the DOM. This can be used to provide
   * a different display value to the raw value, similar to a combobox
   * @param {String} value The value to set the display to
   */
  setDisplayValue: function(value) {
    this.displayValue = value;
    
    this.setRawValue(this.getRawValue());
  },
  
  /**
   * Returns the current value assigned to the field
   * @return {Mixed} The current value of the field
   */
  getRawValue : function(){
    var v = Ext.value(this.value, '');
    
    if (v === this.emptyText) v = '';
    if (this.htmlEncode) v = Ext.util.Format.htmlDecode(v);
    
    return v;
  },
  
  /**
   * Sets the actual value stored in this field. To set the displayed value instead, use setDisplayValue
   */
  setRawValue: function(value) {
    if(this.htmlEncode){
      value = Ext.util.Format.htmlEncode(value);
    }
    
    var displayValue = this.displayValue || (Ext.isEmpty(value) ? '' : value);
    
    if (this.rendered) this.el.dom.innerHTML = displayValue;
    
    return this.value = value;
  }
});

Ext.reg('roweditor-display-field', Ext.ux.grid.RowEditor.DisplayField);