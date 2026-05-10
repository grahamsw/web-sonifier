# Specification - UI and Sonifier Configuration Improvements

## Overview
This track aims to enhance the user experience and flexibility of the Web Sonifier demo by decoupling the settings dialog from the playback state, enabling seamless sonifier switching with independent settings, and providing real-time parameter updates.

## Functional Requirements
- **Persistent Settings Access**: The \"Settings\" button shall be enabled whenever a sonifier type is selected, regardless of whether it is currently playing.
- **Dynamic Sonifier Switching**:
    - Users shall be able to change the sonifier type via the dropdown while audio is playing.
    - When switched, the current sonifier must be cleanly destroyed and the new sonifier immediately initialized and started.
    - **Independent Settings**: Each sonifier type shall maintain its own configuration (input range, output range, curve, and specific parameters). Switching sonifiers loads the target sonifier's specific settings.
- **Real-Time Parameter Updates**:
    - Changes made to any parameter within the Settings dialog shall be applied to the active sonifier immediately.
    - The audio response shall be smooth and responsive.
- **Full Parameter Exposure**: The Settings dialog shall expose all parameters defined in the sonifier's schema.
- **Persistence**: All changes made in the Settings dialog shall be persisted to `localStorage` immediately.

## Acceptance Criteria
- [ ] Settings button is enabled on page load.
- [ ] Changing parameters in the dialog while playing audibly updates the sound in real-time.
- [ ] Changing the sonifier dropdown while playing stops the old sound and starts the new one seamlessly using its own settings.
- [ ] All parameters from the sonifier schema are visible and editable in the dialog.
- [ ] Refreshing the page retains all modified settings for each sonifier type.

## Out of Scope
- Adding new sonifier types.
