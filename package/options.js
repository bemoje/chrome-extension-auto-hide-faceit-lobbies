// user options set to their defaults
const options = {
   enabled: true,
   hideNotJoinable: true,
   hideNotReady: true,
   hidePlaying: true,
   hideQueuing: true,
   outputDebuggingMessages: true,
};

// On page load, restores state using the options stored in chrome.storage.
document.addEventListener('DOMContentLoaded', () => {
   chrome.storage.sync.get(options, (items) => {
      for (let key in items) {
         document.getElementById(key).checked = items.enabled;
      }
   });
   // add option change event listeners to each checkbox that immediately persist option changes
   for (const key in options) {
      document.getElementById(key).addEventListener('change', (event) => {
         options[key] = event.target.checked;
         chrome.storage.sync.set({options}, () => {
            // Update status to let user know changes were saved.
            const status = document.getElementById('status');
            status.textContent = 'Changes saved.';
            setTimeout(() => {
               status.textContent = '';
            }, 750);
         });
      });
   }
   // if enabled state is changes in the application, automatically set/remove checkmark for 'enabled'.
   chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.options?.newValue) {
         changes = changes.options.newValue;
         options.enabled = changes.enabled;
         document.getElementById('enabled').checked = options.enabled;
      }
   });
});
