-- Test mod used by the golden parity suite. Exercises select/new/copy commands,
-- multi-line strings, truncated commands, errors and warnings.
#modname "Golden Test Mod"
#description "A mod for testing
that spans several lines"
#version 1.0

#selectmonster 89 -- Warlock
#gcost 50
#hp 30
#mr 18
#holy
#end

#newmonster 5000
#copystats 89
#copyspr 89
#name "Golden Warlock"
#descr "A warlock made of gold."
#weapon "Broad Sword"
#armor "Full Helmet"
#magicskill 0 3
#end

#selectspell "Shocking Grasp"
#fatiguecost 5
#damage 25
#end

#newweapon 2001
#name "Golden Blade"
#dmg 12
#att 3
#len 2
#end

#newitem
#name "Golden Crown"
#type 9
#constlevel 3
#mainpath 0
#mainlevel 2
#mr 3
#end

#selectsite 1
#gems 0 3
#end

#selectmonster 92
#gcostt 77
#end

#bogus 1
#selectmonster 99999
#end
#selectmonster 90
#hp 20
