<style>
    div div {
        width: 200px;
        height: 300px;
        outline: 1px solid;
        float: left;
        margin: 10px;
    }
    div div span.link {
        position: absolute;
        width: 200px;
        height: 300px;
    }
    span.blue {
        background-color: blue;
    }
    span.red {
        background-color: red;
    }
    span.purple {
        background-color: purple;
    }
    span.orange {
        background-color: orange;
    }
    span.green {
        background-color: lime;
    }
    span.yellow {
        background-color: yellow;
    }
    span.orangered {
        background-color: orangered;
    }
    span.forestgreen {
        background-color: forestgreen;
    }
    span.fuchsia {
        background-color: fuchsia;
    }
    span.crimson {
        background-color: crimson;
    }
</style>

<?PHP

$colors = array( "purple", "blue", "red", "orange", "lime", "yellow", "orangered", "forestgreen", "fuchsia", "crimson");

// decide how we are running and do an appropriate new line
if (php_sapi_name() == "cli")
    $nl = "\n";
else
    $nl = "<br/>";

global $db;
$db = new SQLite3('myradiodb.php');




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
    switchBright int,
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

if(isset($_GET['radio'])) {
    displayCurrentRadioMenu($_GET['radio']);
} else if(isset($_GET['newRadio'])) {
    displayNewRadioMenu();
} else if(isset($_GET['newManualRadio'])) {
    displayManualRadioAdd();
} else {
    displayRadioMenu();
}

//  TODO: colorful layout, switches side by side showing how many it has and if they are programmed or not.
//newRadio("radio1","desc","porch");
//    if (!processRadio(1))
//        echo "fail";
//    else
//        echo "good";

/*
 * Displays the main radio menu.
 */
function displayRadioMenu() {
    global $db;
    echo "<div>";    
    $sql = "select * from radios";
    $result = $db->query($sql);
    while($radioInfo = $result->fetchArray(SQLITE3_ASSOC)) {
        $colorID = $radioInfo['id'] - 1;
        while($colorID >= 10)
            $colorID -= 10;
        ?>
        <div><a href="?radio=<?= $radioInfo['id'] ?>"><span class="link <?=$colors['colorID']?>"><?= $radioInfo['name'] ?>
                    <br/><?= $radioInfo['description'] ?></span></a></div>
        <?PHP
    }
    ?>
    <div><a href="?newRadio=true"><span class="link purple">Automatically add new radio.</span></a></div>
    <div><a href="?newManualRadio=true"><span class="link purple">Manually add new radio.</span></a></div>
    </div>
    <?PHP
}

/*
 * Displays the current radio menu when we have a radio set up.
 */
function displayCurrentRadioMenu($radioID) {
    // get info about the radio
    $sql = "select count(switchStuff) from switches where radioID = :radioID and switchStuff != 255";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $switchCount = $result->fetchArray();
    
    $sql = "select count(programNumber) from programs where radioID = :radioID and days != 255";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $programCount = $result->fetchArray();
    
    $sql = "select count(pinStuff) from inputs where radioID = :radioID and pinStuff != 255";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $inputCount = $result->fetchArray();
    
    $sql = "select count(colorChangeNumber) from colorChanges where radioID = :radioID and (red != 0 or green != 1 or blue != 0)";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $colorChangeCount = $result->fetchArray();
    
      $sql = "select count(limitNumber) from timeLimits where radioID = :radioID and (startTime != 0 or stopTime != 0 or days != 0)";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $timeLimitCount = $result->fetchArray();
    
}


/*
 * Run a radio command. Either returns the array output from the command
 * or if you specify a desiredLine it just sends that line.
 */

function radioCommand($radioID, $command, $desiredLine = "") {
    global $db;
    $statement = $db->prepare("SELECT * FROM radios WHERE id = :id");
    $statement->bindValue(":id", $radioID, SQLITE3_INTEGER);
    $result = $statement->execute();
    $radio = $result->fetchArray(SQLITE3_ASSOC);
    $commandToRun = "nrfcl -t " . $radio['rxAddress0'] . " -r " . $radio['txAddress'] . " " . $command;
    // Sometimes we want more than one line of the result or we don't care
    if ($desiredLine == "") {
        $returnArray = array();
        exec($commandToRun, $returnArray);
        return $returnArray;
    }

    $attempts = 0;
    while ($attempts < 10) {
        $attempts++;
        $returnArray = array();
        exec($command, $returnArray);
        // make sure we got something
        foreach ($returnArray as $line) {
            // see if we got the response we are looking for
            if (strpos($line, $desiredLine) === 0)
                return $line;
        }
        usleep(10000);
    }
    return false;
}

// Get the basic information of a new radio and assign it its very own address
function newRadio($name = "", $description = "", $location = "") {
    global $db;
    //First see if there is a radio there using default address
    $returnArray = array();
    exec("nrfcl -t f0f0f0f001 -r f0f0f0f001 gi", $returnArray);
    if (strpos($returnArray[0], "ok") === false)
        return false;
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
            strpos($returnString, "CC") === false)
        return false;
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
    echo $db->lastInsertRowID();
    $command = "nrfcl -t $freq -r $freq SA";
    exec($command, $returnArray);


    return true;
}

/* Get the information for the radio
 */

function processRadio($radioID) {
    global $db;
    global $nl;
    $response = radioCommand($radioID, "du");
    $reachedTheEnd = 0;
    $lineNumber = 0;
    foreach ($response as $line) {
        if (strpos($line, "Transm") === 0)
            continue;
        $lineArray = explode("-", $line);
        $thisNumber = hexdec(substr($lineArray[0], -2));
        if ($thisNumber <> $lineNumber) {
            echo "$thisNumber | $lineNumber";
            echo "Line in fail";
            exit;
        }
        $lineNumber ++;
        if (strpos($lineArray[0], "END") === 0) {
            $reachedTheEnd = 1;
        }
    }
    if ($reachedTheEnd == 0) {
        echo "Didn't receive all lines$nl";
        return false;
    }
    // K we got all the lines in order. Lets process them
    $misc = $switches = $programs = $inputs = $timeLimits = $colorChanges = "";
    foreach ($response as $line) {
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
    $stuff = explode("|", $misc);
    $sql = "update radios set clockTweak = \"{$stuff[0]}\", daylightSavingsStartMonth = \"{$stuff[1]}\", " .
            "daylightSavingsStartDay = \"{$stuff[2]}\", daylightSavingsStopMonth = \"{$stuff[3]}\", " .
            "daylightSavingsStopDay = \"{$stuff[4]}\", pwmDirection = \"{$stuff[5]}\", " .
            "inputMessageTiming = \"{$stuff[6]}\" where id = $radioID";
    if (!$db->exec($sql))
        echo $db->lastErrorMsg();
    $switchDetails = str_split($switches, 6);
    for ($x = 0; $x < count($switchDetails); $x++) {
        $thisSwitch = str_split($switchDetails[$x], 2);
        $thisSwitchStuff = hexdec($thisSwitch[0]);
        $thisSwitchBright = hexdec($thisSwitch[1]);
        $thisSwitchPWM = hexdec($thisSwitch[2]);
        $sql = "insert or ignore into switches (radioID, switchNumber, switchStuff, switchBright, switchPWM) values " .
                "($radioID, $x, $thisSwitchStuff, $thisSwitchBright, $thisSwitchPWM)";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
        $sql = "update switches set switchStuff = $thisSwitchStuff, switchBright = $thisSwitchBright, " .
                "switchPWM = $thisSwitchPWM where radioID = $radioID and switchNumber = $x";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
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
                "($radioID, $x, $thisDays, $thisStart, $thisDuration, \"$thisSwitches\", $thisRollover)";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
        $sql = "update programs set days = $thisDays, time = $thisStart, duration = $thisDuration, switches = " .
                "\"$thisSwitches\", rollover = $thisRollover where radioID = $radioID and programNumber = $x";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
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
                "($radioID, $x, $thisPinStuff, $thisLowPercent, $thisHighPercent, " .
                "$thisWhichSwitchOrProgram, $thisDuration, $thisPollTime, $thisWhichRGB)";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
        $sql = "update inputs set pinStuff = $thisPinStuff, lowPercent = $thisLowPercent, highPercent = " .
                "$thisHighPercent, whichSwitchOrProgram = $thisWhichSwitchOrProgram, duration = $thisDuration, " .
                "pollTime = $thisPollTime, whichRGB = $thisWhichRGB where radioID = $radioID and inputNumber = $x";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
    }
    $timeLimitsDetails = str_split($timeLimits, 3);
    for ($x = 0; $x < count($timeLimitsDetails); $x++) {
        $thisTimeLimit = str_split($timeLimitsDetails[$x]);
        $thisStartTime = $thisTimeLimit[0];
        $thisStopTime = $thisTimeLimit[1];
        $thisDays = $thisTimeLimit[2];
        $sql = "insert or ignore into timeLimits (radioID, limitNumber, startTime, stopTime, " .
                "days) values ($radioID, $x, $thisStartTime, $thisStopTime, $thisDays)";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
        $sql = "update timeLimits set startTime = $thisStartTime, stopTime = $thisStopTime, " .
                "days = $thisDays where radioID = $radioID and limitNumber = $x";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
    }
    $colorChangeDetails = str_split($colorChanges, 7);
    for ($x = 0; $x < count($colorChangeDetails); $x++) {
        $thisColorChange = str_split($colorChangeDetails[$x]);
        $thisRed = dechex($thisColorChange[0] . $thisColorChange[1]);
        $thisGreen = dechex($thisColorChange[2] . $thisColorChange[3]);
        $thisBlue = dechex($thisColorChange[4] . $thisColorChange[5]);
        if ($thisColorChange[6] == "Y")
            $thisChangeable = 1;
        else
            $thisChangeable = 0;
        $sql = "insert or ignore into colorChanges (radioID, colorChangeNumber, red, green, blue, "
                . "ifChangeable) values ($radioID, $x, $thisRed, $thisGreen, $thisBlue, $thisChangeable)";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
        $sql = "update colorchanges set red = $thisRed, green = $thisGreen, blue = $thisBlue, "
                . "ifChangeable = $thisChangeable where radioID = $radioID and colorChangeNumber = $x";
        if (!$db->exec($sql))
            echo $db->lastErrorMsg();
    }
    return true;
}

/* Get the information for the switches
 * Applicable Database:
 * CREATE TABLE IF NOT EXISTS switches (id int PRIMARY KEY,
 *   radioID int,switchNumber int,type text,details text
 * Details - Switch Port,pin,direction - PWM color - pwm#,direction,red,green,blue
 * color change: pwm#,number color changes,direction,color change time,red,green,blue,...
 * hue change - pwm#,hue speed,direction 
 * brightness - brightness value (1-16)
 */
?>
<div>
    <div><a href="#"><span class="link blue"></span></a></div>
    <div><a href="#"><span class="link red"></span></a></div>
    <div><a href="#"><span class="link purple"></span></a></div>
    <div><a href="#"><span class="link orange"></span></a></div>
    <div><a href="#"><span class="link green"></span></a></div>
    <div><a href="#"><span class="link yellow"></span></a></div>
    <div><a href="#"><span class="link orangered"></span></a></div>
    <div><a href="#"><span class="link forestgreen"></span></a></div>
    <div><a href="#"><span class="link fuchsia"></span></a></div>
    <div><a href="#"><span class="link crimson"></span></a></div>
</div>
