<?php

global $db;
$db = new SQLite3('myradiodb.php');
switch ($_GET['function']) {
    case "getRadios":
        echo getRadios();
        break;
    case "radioDetails":
        echo radioDetails($_GET['radioID']);
        break;
}

/*
 * Return the list of radios
 */

function getRadios() {
    global $db;
    $sql = "select * from radios";
    $result = $db->query($sql);
    while ($row = $result->fetchArray(SQLITE3_ASSOC))
        $radioInfo[] = $row;
    // one too many entries
    return json_encode($radioInfo);
}

/*
 * Return the summary of a single radio
 */

function radioDetails($radioID) {
    $radioID = intval($radioID);
    global $db;
    // check if the radio is valid
    $sql = "select * from radios where id = :radioID";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID))
        return (json_encode(array("fail" => $db->lastErrorMsg())));
    $result = $statement->execute();
    $row = $result->fetchArray();
    if ($row == false)
        return (json_encode(array("fail" => "Invalid radio id")));
    $radioDetail = $row;

    // no go through and get all of the details
    $sql = "select * from switches where radioID = :radioID and switchStuff != 255";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $switches = array();
    while ($row = $result->fetchArray())
        $switches[] = $row;

    $sql = "select * from programs where radioID = :radioID and time != 65535";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $programs = array();
    while ($row = $result->fetchArray())
        $programs[] = $row;

    $sql = "select * from inputs where radioID = :radioID and pinStuff != 255";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $inputs = array();
    while ($row = $result->fetchArray())
        $inputs[] = $row;

    $sql = "select * from colorChanges where radioID = :radioID and (red != 0 or green != 1 or blue != 0)";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $colors = array();
    while ($row = $result->fetchArray())
        $colors[$row['colorChangeNumber']] = $row;

    $sql = "select * from timeLimits where radioID = :radioID and (startTime != 0 or stopTime != 0 or days != 0)";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
        echo $db->lastErrorMsg();
    $result = $statement->execute();
    $timeLimits = array();
    while ($row = $result->fetchArray())
        $timeLimits[] = $row;

    $outArray = array(
        "radio" => $radioDetail,
        "switches" => $switches,
        "program" => $programs,
        "inputs" => $inputs,
        "colors" => $colors,
        "timeLimits" => $timeLimits,
    );
    if (isset($_GET['debug'])) {
        echo "<pre>";
        print_r($outArray);
        echo "</pre>";
    }
    return json_encode($outArray);
}

?>