<?php

/*
 * Run a radio command. Either returns the array output from the command
 * or if you specify a desiredLine it just sends that line.
 */

function radioCommand($radioID, $command, $desiredLine = "", $shortResponse = 0) {
    global $debug;
    if ($debug == true)
        return true;
    global $db;
    $statement = $db->prepare("SELECT * FROM radios WHERE id = :id");
    $statement->bindValue(":id", $radioID, SQLITE3_INTEGER);
    $result = $statement->execute();
    $radio = $result->fetchArray(SQLITE3_ASSOC);
    // Decide if we want to wait for the whole response or a short one
    $shortSwitch = "";
    if ($shortResponse == 1)
        $shortSwitch = " -s 1 ";
    $commandToRun = "nrfcl -t " . $radio['rxAddress0'] . " -r " . $radio['txAddress'] . " " . $shortSwitch . $command;
    //echo $commandToRun;
    // Sometimes we want more than one line of the result or we don't care
    if ($desiredLine == "") {
        $returnArray = array();
        exec($commandToRun, $returnArray);
        return $returnArray;
    }

    $returnArray = array();
    exec($commandToRun, $returnArray);
    // make sure we got something
    foreach ($returnArray as $line) {
        // see if we got the response we are looking for
        if (strpos($line, $desiredLine) === 0)
            return true;
    }

    if (isset($returnArray[1]))
        return $returnArray[1];
    return false;
}




/* Get the information for the radio
 */

function processRadio($radioID) {
    global $db;
    $reachedTheEnd = 0;

    // try 5 times to get all the lines.
    for ($tries = 0; $tries < 5; $tries++) {
        $response = radioCommand($radioID, "du");
        foreach ($response as $line) {
            // get rid of first line
            if (strpos($line, "Transm") === 0)
                continue;
            $lineArray = explode("-", $line);
            $thisNumber = hexdec(substr($lineArray[0], -2));
            $radioOutput[$thisNumber] = $line;
            if (strpos($lineArray[0], "END") === 0 and ( $thisNumber + 1) == count($radioOutput)) {
                $reachedTheEnd = 1;
                $tries = 5;
            }
        }
    }
    if ($reachedTheEnd == 0) {
        echo "Didn't receive all lines<br/>";
        return false;
    }
    // K we got all the lines in order. Lets process them
    $misc = $switches = $programs = $inputs = $timeLimits = $colorChanges = "";
    foreach ($radioOutput as $line) {
        if (strpos($line, "Transm") === 0)
            continue;
        $lineArray = explode("-", $line);
        $letter = substr($lineArray[0], 0, 1);
        if ($letter == "M")
            $misc .= $lineArray[1];
        else if ($letter == "S")
            $switches .= $lineArray[1];
        else if ($letter == "P")
            $programs .= $lineArray[1];
        else if ($letter == "I")
            $inputs .= $lineArray[1];
        else if ($letter == "T")
            $timeLimits .= $lineArray[1];
        else if ($letter == "C")
            $colorChanges .= $lineArray[1];
        else
            $radioTime = $lineArray[1];
    }
    // TODO: use bind to make these sql entries safe
    $stuff = explode("|", $misc);
    $sql = "update radios set clockTweak = '{$stuff[0]}', daylightSavingsStartMonth = '{$stuff[1]}', "
            . "daylightSavingsStartDay = '{$stuff[2]}', daylightSavingsStopMonth = '{$stuff[3]}', "
            . "daylightSavingsStopDay = '{$stuff[4]}', pwmDirection = '{$stuff[5]}', "
            . "inputMessageTiming = '{$stuff[6]}', hueSpeed = '{$stuff[7]}', "
            . "colorChangeSpeed = '{$stuff[8]}' where id = $radioID";
    if (!$db->exec($sql)) {
        echo $db->lastErrorMsg();
        echo " updating radios<br>";
    }
    $switchDetails = str_split($switches, 4);
    for ($x = 0; $x < count($switchDetails); $x++) {
        $thisSwitch = str_split($switchDetails[$x], 2);
        $thisSwitchStuff = hexdec($thisSwitch[0]);
        $thisSwitchPWM = hexdec($thisSwitch[1]);
        $sql = "insert or ignore into switches (radioID, switchNumber, switchStuff, switchPWM) values " .
                "($radioID, $x, $thisSwitchStuff, $thisSwitchPWM)";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at switches 1<br/>$sql<br/>";
        }
        $sql = "update switches set switchStuff = $thisSwitchStuff, " .
                "switchPWM = $thisSwitchPWM where radioID = $radioID and switchNumber = $x";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at switches 2<br/>$sql<br/>";
        }
    }
    $programDetails = str_split($programs, 20);
    for ($x = 0; $x < count($programDetails); $x++) {
        $thisProgram = str_split($programDetails[$x], 2);
        $thisDays = hexdec($thisProgram[0]);
        $thisStart = hexdec($thisProgram[1] . $thisProgram[2]);
        $thisDuration = hexdec($thisProgram[3] . $thisProgram[4]);
        $thisSwitches = "";
        for ($y = 5; $y <= 8; $y++) {
            if ($thisProgram[$y] != "FF") {
                if ($thisSwitches != "")
                    $thisSwitches .= ",";
                $thisSwitches .= $thisProgram[$y];
            }
        }
        $thisRollover = hexdec($thisProgram[9]);
        $sql = "insert or ignore into programs (radioID, programNumber, days, time, duration, switches, rollover) values " .
                "('$radioID', '$x', '$thisDays', '$thisStart', '$thisDuration', '$thisSwitches', '$thisRollover')";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at programs 1<br/>$sql<br/>";
        }
        $sql = "update programs set days = '$thisDays', time = '$thisStart', duration = '$thisDuration', switches = " .
                "'$thisSwitches', rollover = '$thisRollover' where radioID = '$radioID' and programNumber = '$x'";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at programs 2<br/>$sql<br/>";
        }
    }
    $inputDetails = str_split($inputs, 16);
    for ($x = 0; $x < count($inputDetails); $x++) {
        $thisInput = str_split($inputDetails[$x], 2);
        $thisPinStuff = hexdec($thisInput[0]);
        $thisLowPercent = hexdec($thisInput[1]);
        $thisHighPercent = hexdec($thisInput[2]);
        $thisWhichSwitchOrProgram = hexdec($thisInput[3]);
        $thisDuration = hexdec($thisInput[4] . $thisInput[5]);
        $thisPollTime = hexdec($thisInput[6]);
        $thisWhichRGB = hexdec($thisInput[7]);
        $sql = "insert or ignore into inputs (radioID, inputNumber, pinStuff, lowPercent, highPercent, " .
                "whichSwitchOrProgram, duration, pollTime, whichRGB) values " .
                "('$radioID', '$x', '$thisPinStuff', '$thisLowPercent', '$thisHighPercent', " .
                "'$thisWhichSwitchOrProgram', '$thisDuration', '$thisPollTime', '$thisWhichRGB')";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at inputs 1<br/>$sql<br/>";
        }
        $sql = "update inputs set pinStuff = '$thisPinStuff', lowPercent = '$thisLowPercent', highPercent = " .
                "'$thisHighPercent', whichSwitchOrProgram = $thisWhichSwitchOrProgram, duration = $thisDuration, " .
                "pollTime = '$thisPollTime', whichRGB = '$thisWhichRGB' where radioID = '$radioID' and inputNumber = '$x'";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at inputs 2<br/>$sql<br/>";
        }
    }
    $timeLimitsDetails = str_split($timeLimits, 14);
    for ($x = 0; $x < count($timeLimitsDetails); $x++) {
        $thisStartTime = hexdec(substr($timeLimitsDetails[$x], 0, 6));
        $thisStopTime = hexdec(substr($timeLimitsDetails[$x], 6, 6));
        $thisDays = hexdec(substr($timeLimitsDetails[$x], 12, 2));
        $sql = "insert or ignore into timeLimits (radioID, limitNumber, startTime, stopTime, " .
                "days) values ('$radioID', '$x', '$thisStartTime', '$thisStopTime', '$thisDays')";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at timeLimits 1<br/>$sql<br/>";
        }
        $sql = "update timeLimits set startTime = '$thisStartTime', stopTime = '$thisStopTime', " .
                "days = '$thisDays' where radioID = '$radioID' and limitNumber = '$x'";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at timeLimits 2<br/>$sql<br/>";
        }
    }
    $colorChangeDetails = str_split($colorChanges, 7);
    for ($x = 0; $x < count($colorChangeDetails); $x++) {
        $thisColorChange = str_split($colorChangeDetails[$x]);
        $thisRed = hexdec($thisColorChange[0] . $thisColorChange[1]);
        $thisGreen = hexdec($thisColorChange[2] . $thisColorChange[3]);
        $thisBlue = hexdec($thisColorChange[4] . $thisColorChange[5]);
        if ($thisColorChange[6] == "Y")
            $thisChangeable = 1;
        else
            $thisChangeable = 0;
        $sql = "insert or ignore into colorChanges (radioID, colorChangeNumber, red, green, blue, "
                . "ifChangeable) values ($radioID, $x, $thisRed, $thisGreen, $thisBlue, $thisChangeable)";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at colorchanges 1<br/>$sql<br/>";
        }
        $sql = "update colorchanges set red = $thisRed, green = $thisGreen, blue = $thisBlue, "
                . "ifChangeable = $thisChangeable where radioID = $radioID and colorChangeNumber = $x";
        if (!$db->exec($sql)) {
            echo $db->lastErrorMsg();
            echo " at colorchanges 2<br/>$sql<br/>";
        }
    }
    return "ok";
}

// Get the basic information of a new radio and assign it its very own address
function newRadio($name = "", $description = "", $location = "") {
    global $db;
    //First see if there is a radio there using default address
    $returnArray = array();
    exec("nrfcl -t f0f0f0f001 -r f0f0f0f001 gi", $returnArray);
    if (!isset($returnArray[0]) or strpos($returnArray[0], "ok") === false) {
        echo "No radio communication";
        return false;
    }

    $sql = "SELECT max(rxAddress0) from radios";
    $result = $db->query($sql);
    if ($result == false)
        $freq = "f0f0f0f002";
    else {
        $row = $result->fetchArray(SQLITE3_NUM);
        if ($row[0] == NULL)
            $freq = "f0f0f0f002";
        else {
            $lastFreq = $row[0];
            $freqNum = "0x" . substr($lastFreq, 6);
            $thisFreq = intval($freqNum, 16) + 1;
            $newFreq = dechex($thisFreq);
            while (strlen($newFreq) < 4)
                $newFreq = "0" . $newFreq;
            $freq = substr($lastFreq, 0, 6) . $newFreq;
        }
    }

    // Now actually send the changes to the radio
    // set the receive frequency to the new frequency
    $command = "nrfcl -t f0f0f0f001 -r f0f0f0f001 RC:0:0x$freq";
    $returnArray = 0;
    exec($command, $returnArray);
    if (count($returnArray) < 2) {
        print_r($returnArray);
        return false;
    }
    // set the transmit frequency to the new frequency
    $command = "nrfcl -t $freq -r $freq RC:T:0x$freq";
    $returnArray = 0;
    exec($command, $returnArray);
    if (count($returnArray) < 2) {
        print_r($returnArray);
        return false;
    }

    // do the update
    return existingNewRadio($name, $description, $location, $freq);
}

// Get a new radio from an existing address
function existingNewRadio($name = "", $description = "", $location = "", $freq) {
    global $db;
    //First see if there is a radio there using default address
    $returnArray = array();
    exec("nrfcl -t $freq -r $freq gi", $returnArray);
    if (!isset($returnArray[0]) or strpos($returnArray[0], "ok") === false) {
        echo "No radio communication!<br/>";
        print_r($returnArray);
        return false;
    }
    $returnString = "";
    foreach ($returnArray as $line) {
        if (strpos($line, "Transmitting") === false)
            $returnString .= $line;
    }
    //Make sure we got the whole message
    if (strpos($returnString, "Pr") === false or
            strpos($returnString, "Sw") === false or
            strpos($returnString, "In") === false or
            strpos($returnString, "Li") === false or
            strpos($returnString, "CC") === false) {
        echo "Didn't receive summary.";
        return false;
    }
    // k cool. We have all the info
    $radioParams = explode(",", $returnString);
    for ($x = 0; $x < count($radioParams); $x+=2) {
        $number = explode("/", $radioParams[$x + 1]);
        $programmed = $number[0];
        $total = $number[1];
        switch ($radioParams[$x]) {
            case "Pr":
                $programs = $total;
                break;
            case "Sw":
                $switches = $total;
                break;
            case "In":
                $inputs = $total;
                break;
            case "Li":
                $limits = $total;
                break;
            case "CC":
                $colorChanges = $total;
                break;
        }
    }


    $sql = "INSERT INTO radios (name, description, location, switchCount, 
        programCount, inputCount, timeLimitCount, colorChangeCount, txAddress, 
        rxAddress0) values (:name, :description, :location, $switches, 
        $programs, $inputs, $limits, $colorChanges, '$freq', '$freq')";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":name", $name, SQLITE3_TEXT))
        echo $db->lastErrorMsg();
    $statement->bindValue(":description", $description, SQLITE3_TEXT);
    $statement->bindValue(":location", $location, SQLITE3_TEXT);
    $result = $statement->execute();
    if (!$result)
        echo $db->lastErrorMsg();
    $radioID = $db->lastInsertRowID();
    // save setup
    $command = "nrfcl -t $freq -r $freq SA";
    exec($command, $returnArray);
    // set clock
    $command = "nrfcl -t $freq -r $freq";
    exec($command, $returnArray);
    // get info from the radio
    processRadio($radioID);

    return "ok";
}

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

?>
