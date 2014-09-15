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


<div>
    <?PHP
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
    details text
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
    rollover int
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
    whichRGB int
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
    days int
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
    ifChangable int
    )");
    
//  TODO: colorful layout, switches side by side showing how many it has and if they are programmed or not.
//newRadio("radio1","desc","porch");
    if (!processRadio(1))
        echo "fail";
    else
        echo "good";



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
        echo $commandToRun;
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
        echo "<pre>";
        print_r($response);
        echo "</pre>";
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
            $lineArray = explode("-",$line);
            $letter = substr($lineArray[0],0,1);
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
            else if ($letter == "C")
                $colorChangable .= $lineArray[1];
            else if ($letter == "P")
                $pwmSwitch .= $lineArray[1];
            else
                $radioTime = $lineArray[1];
        }
        echo $misc;
        $stuff = explode("|",$misc);
        $sql = "update radios set clockTweak = \"{$stuff[0]}\", daylightSavingsStartMonth = \"{$stuff[1]}\", ".
                "daylightSavingsStartDay = \"{$stuff[2]}\", daylightSavingsStopMonth = \"{$stuff[3]}\", ".
                "daylightSavingsStopDay = \"{$stuff[4]}\", pwmDirection = \"{$stuff[5]}\", ".
                "inputMessageTiming = \"{$stuff[6]}\" where id = $radioID";
        echo $sql;
        $db->exec($sql);
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
