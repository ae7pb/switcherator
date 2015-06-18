<?php


// Will create the database if it isn't already there
function redoDatabase() {
    global $db;
// Radio table.  Has the radio, serial numbers and switch capabilities
    $db->exec("CREATE TABLE IF NOT EXISTS radios (
    id INTEGER PRIMARY KEY,
    name text,
    description text,
    location text,
    switchCount int,
    programCount int,
    inputCount int,
    timeLimitCount int,
    colorChangeCount int,
    clockTweak int,
    daylightSavingsStartMonth int,
    daylightSavingsStartDay int,
    daylightSavingsStopMonth int,
    daylightSavingsStopDay int,
    pwmDirection int,
    inputMessageTiming int,
    hueSpeed int,
    colorChangeSpeed int,
    txAddress text,
    rxAddress0 text,
    rxAddress1 text,
    rxAddress2 text,
    rxAddress3 text,
    rxAddress4 text,
    rxAddress5 text,
    inputAddress text
)");
    /* Switch table.  Which radio it has, switch number on radio, type of switch and details.
     * Types: Switch, PWM Single Color, PWM Color Change, PWM Hue change
     * Details - Switch Port,pin,direction - PWM color - pwm#,direction,red,green,blue
     * color change: pwm#,# color changes,direction,color change time,red,green,blue,...
     * hue change - pwm#,hue speed,direction
     */
    $db->exec("CREATE TABLE IF NOT EXISTS switches (
    id INTEGER PRIMARY KEY,
    radioID int,
    switchNumber int,
    switchStuff int,
    switchPWM int,
    details text,
    unique(radioID, switchNumber)
)");
// Program table.  Which radio, program number, start time, duration in minutes, 
// days and which switches it uses.  So it is searchable the days will be
// Sun Mon Tue Wed Thu Fri Sat
    $db->exec("CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY,
    radioID int,
    programNumber int,
    days int,
    time int,
    duration int,
    switches text,
    rollover int,
    unique(radioID,programNumber)
)");
// Input table. Which radio, input number, details is port / pin / percentages of on off,
// program is the program or switch that it turns on, duration is time in seconds that 
// the switch stays on, poll time is seconds or 0 for continuous
// for the program indicate if this is doing various things based on analog info and
// which RGB colors are affected by analog info
    $db->exec("CREATE TABLE IF NOT EXISTS inputs (
    id INTEGER PRIMARY KEY,
    radioID int,
    inputNumber int,
    pinStuff int,
    lowPercent int,
    highPercent int,
    whichSwitchOrProgram int,
    duration int,
    pollTime int,
    whichRGB int,
    unique(radioID,inputNumber)
)");
    /*
     * Time limit table.  This sets up when a program will react to an input
     * Start time, stop time. Days is same format as programs
     */
    $db->exec("CREATE TABLE IF NOT EXISTS timeLimits (
    id INTEGER PRIMARY KEY,
    radioID int,
    limitNumber int,
    startTime int,
    stopTime int,
    days int,
    unique(radioID,limitNumber)
)");
    /*
     * Color Changes table
     * stores all of the PWM data and if it can be used to swap colors
     */
    $db->exec("CREATE TABLE IF NOT EXISTS colorChanges (
    id INTEGER PRIMARY KEY,
    radioID int,
    colorChangeNumber int,
    red int,
    green int,
    blue int,
    ifChangeable int,
    unique(radioID,colorChangeNumber)
    )");
}
