Visual Changes:
- add chat feature to the move log div (can be move log or a caht to talk to opponent)
- (FUTURE) animations for house of netting, bonus, waters of chaos, and being bourne off.
- does not render the oopponents chosen color, only the users own color. other is default. 
    - no logic to handle if users choose the same color
    - allows users to choose any rgb. should give them a list of 10 predetermined color choices t0o choose from instead of infinite. (ROYGB + purple, black, white, cyan, silver)


Performance Changes:
- reloading the game gives an instant resign - no game state maintainence to handle disconnections

Logic Changes:
- allow users to chat to each other in game
- add "rematch" || "new game" option on game finish screen
- friends:
    - cannot delete friends once added
    - users should have th option to invite a friend to a game (or send them a link)
    * these 2 options can be simple buttons within the "friend-list" li element off the the right. a trashbin symbol for delete and a user with a + or just a + for new game which leads to a popup where you can send the game directly. or copy a link that directly makes a private game and allows the recipient to join the private match directly.