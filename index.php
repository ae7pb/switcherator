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
if(php_sapi_name() == "cli")
        $nl = "\n";
else
        $nl = "<br/>";
$db = new SQLite3('myradiodb.php');

// Radio table.  Has the radio, serial numbers and switch capabilities
$db->exec("CREATE TABLE IF NOT EXISTS radios (
        id int PRIMARY KEY,
        serialNo text,
        description text,
        location text,
        switchCount int,
        programCount int,
        inputCount int,
        timeLimitCount int
        )");
// Switch table.  Which radio it has, switch number on radio, type of switch and details.
// Types: Binary, PWM Single Color, PWM Color Change, PWM Hue change
// Details as appropriate
$db->exec("CREATE TABLE IF NOT EXISTS switches (
        id int PRIMARY KEY,
        radioID int,
        switchNumber int,
        type text,
        details text
        )");
// Program table.  Which radio, program number, start time, duration in minutes, 
// days and which switches it uses.  So it is searchable the days will be
// Sun Mon Tue Wed Thu Fri Sat
$db->exec("CREATE TABLE IF NOT EXISTS programs (
        id int PRIMARY KEY,
        radioID int,
        programNumber int,
        time text,
        duration int,
        days text,
        switches text
        )");
// Input table. Which radio, input number, details is port / pin / percentages of on off,
// program is the program or switch that it turns on, duration is time in seconds that 
// the switch stays on, poll time is seconds or 0 for continuous
// for the program indicate if this is doing various things based on analog info and
// which RGB colors are affected by analog info
$db->exec("CREATE TABLE IF NOT EXISTS inputs (
        id int PRIMARY KEY,
        radioID int,
        inputNumber int,
        details text,
        program text,
        duration int,
        pollTime int
        )");




echo '<form>Enter a response:<input name="testInput"/><input type="submit"/></form>';
    


//getStatus("100001");


function getStatus($serialNum) {
        global $nl,$db;
        if(strlen($serialNum) < 6)
                return "invalid serial number$nl";
        $attempts = 0;
		// Read a general status
		$command = "nrfcl z" . $serialNum . "gs";
		$returnArray = array();
        while(count($returnArray)<5):
			$returnArray = array();
			exec($command, $returnArray);
			// make sure we got something
			usleep(10000);
			$attempts++;
			if($attempts == 10) break;
		endwhile;
        $sql = "SELECT * FROM radios WHERE serialNo = '$serialNum'";
        $results = $db->query($sql);
        $realResult = $results->fetchArray();
        if($realResult === false)
			$radioArray = array('programs'=>array(), 'switches'=>array(), 'inputs'=>array());
        
		$radioArray = parseGeneralStatus($returnArray,$radioArray);

		unset($returnArray);
		usleep(10000);
		radioAttempt2:
		// Read the switch display
		$attempts = 0;
		$command = "nrfcl z" . $serialNum . "sd";
		$returnArray = array();
		while(count($returnArray) < 2):
			$returnArray = array();
			exec($command,$returnArray);
			usleep(10000);
			$attempts++;
			if($attempts == 10) break;
		endwhile;
		$radioArray = parseSwitchDisplay($returnArray,$radioArray);
        var_dump($returnArray);
        echo "<pre>";
        print_r($radioArray);
        echo "</pre>";

}

/*
 * Takes in the general status
 * and parses the results
 * Pass in the radioArray which gets passed back after
 */
function parseGeneralStatus($returnArray,$radioArray) {
	global $nl, $db;
	$programs = $radioArray['programs'];
	$switches = $radioArray['switches'];
	$inputs = $radioArray['inputs'];
	foreach($returnArray as $line) {
		if(strpos($line,"..ok") !== false) {
			echo "ok$nl";
		} else if (strpos($line,"S#") === 0) {
			$time = date("Y/m/d H:i:s",strtotime(substr($line, 11)));
			echo $time.$nl;
		} else if (strpos($line,"Progs") === 0) {
			$aString = str_split(substr($line,5),3);
			foreach($aString as $char) {
				$itemNum = intval(substr($char,0,2));
				if(substr($char,2,1) == "y")
					$programs[$itemNum]['programmed'] = true;
				else
					$programs[$itemNum]['programmed'] = false;
			}
		} else if (strpos($line,"SwOn") === 0) {
			$aString = str_split(substr($line,5),3);
			foreach($aString as $char) {
				$itemNum = intval(substr($char,0,2));
				if(substr($char,2,1) == "y")
					$switches[$itemNum]['turnedOn'] = true;
				else
					$switches[$itemNum]['turnedOn'] = false;
			}
		} else if (strpos($line,"Sw") === 0) {
			$aString = str_split(substr($line,2),3);
			foreach($aString as $char) {
				$itemNum = intval(substr($char,0,2));
				if(substr($char,2,1) == "y")
					$switches[$itemNum]['programmed'] = true;
				else
					$switches[$itemNum]['programmed'] = false;
			}
		} else if (strpos($line,"In") === 0) {
			$aString = str_split(substr($line,2),3);
			foreach($aString as $char) {
				$itemNum = intval(substr($char,0,2));
				if(substr($char,2,1) == "y")
					$inputs[$itemNum]['programmed'] = true;
				else
					$inputs[$itemNum]['programmed'] = false;
			}
		}
		
	}
	$radioArray['programs'] = $programs;
	$radioArray['switches'] = $switches;
	$radioArray['inputs'] = $inputs;
	return $radioArray;
}

function parseSwitchDisplay($returnArray,$radioArray) {
	$switches = $radioArray['switches'];
	foreach($returnArray as $line) {
		if (strpos($line,"#") === 0) {
			$aString = str_split($line,6);
			foreach($aString as $char) {
				$itemNum = intval(substr($char,1,2));
				$switches[$itemNum]['programmed']= false;
				$switches[$itemNum]['type'] = false;
				$switches[$itemNum]['pin'] = false;
				$switches[$itemNum]['direction'] = false;
				switch (substr($char,3)){
					case "COc":
						$switches[$itemNum]['type'] = 'colorChange';
						break;
					case "Brt":
						$switches[$itemNum]['type'] = 'brightnessSetting';
						break;
					case "PWl":
					case "PWf": // had a bug
						$switches[$itemNum]['type'] = 'PWM';
						$switches[$itemNum]['direction'] = 'low';
						break;
					case "PWh":
						$switches[$itemNum]['type'] = 'PWM';
						$switches[$itemNum]['direction'] = 'high';
						break;
					default:
						if(substr($char,3,1) == '?')
							break;
						$switches[$itemNum]['pin'] = substr($char,3,2);
						if(substr($char,5,1) == 'H')
							$switches[$itemNum]['direction'] = "high";
						else
							$switches[$itemNum]['direction'] = "low";
				}
			}
		}
	}
	$radioArray['switches'] = $switches;
	return $radioArray;
}


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
