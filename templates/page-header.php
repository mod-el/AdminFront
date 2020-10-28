<?php
if (!isset($_GET['print'])) {
	?>
	<div id="history-box" style="right: -15%">
		<div class="text-center pad10v">
			[<a href="#" onclick="historyMgr.stepBack(); return false"> indietro </a>]
			[<a href="#" onclick="historyMgr.stepForward(); return false"> avanti </a>]
			[<a href="#" onclick="switchHistoryBox(); return false"> chiudi </a>]
		</div>
		<div id="links-history"></div>
	</div>

	<div class="text-right">
		[<a href="#" onclick="switchHistoryBox(); return false"> storico </a>]
	</div>
	<?php
}
