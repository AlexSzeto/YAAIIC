# Fix Bugs Introduced From Previous Feature (98-anytale-portrait-voice-result-linking-deduplication-cache-lookup)

## Goal
Fix all outstanding bugs introduced by the previous feature implementation that leaves all media generations associated with the feature (thus, the entire AnyTale page) broken.

## Bug Details
- Server side: Partially Broken.
1. Requests to update the Portrait appear to be working on the server side - as refreshing after a Generate Portrait request appears to show a new portrait image associated with the data entry.
2. Requests to update the Voice only works if the client stays on the same page until the server completes the media generation workflow and returns its results. If the client refreshes before generation is complete, the information is lost - even if the server finishes generation successfully.
3. Requests to generate Part previews appears to be generating hashed names and sending them back to the client correctly.

- Client side: Completely Broken.
1. Requests to update the Portrait always fail to update the client data after generation completion - the new portrait wouldn't be seen until a manual refresh is complete.
2. Requests to generation Voice: Again, if the client navigates away from or refreshes the AnyTale page while voice generation is happening, that generation information is lost. It is not being stored in the server properly unless the task completes and returns to the client.
3. The ability to pull up cached images for parts is failing completely. If I generate a parts preview, it shows up. If I change tags or attributes, the preview image remains - which shouldn't happen, because the client should be looking up a hashed image assocaited with the new tag combination. If I generate a new preview image and try to navigate between two tag configurations that should have cached images, still nothing happens. The expected result is that the client should toggle between the two hashed images, because a pre-generated image is available for those tag combinations and they should be pulled up whenever I try to load a part or switch its attributes. These should all happen whether the preview is being generated in the Parts & Plot tab or Character & Outfits tab.

## Tasks

