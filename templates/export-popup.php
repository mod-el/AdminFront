<fieldset class="pad10" style="width: 450px">
	<form action="?" method="post" onsubmit="exportPopup(2); return false" id="export-form">
		<?php
		switch ($_GET['step']) {
			case 1:
				?>
				<h2>Numero massimo di righe per CSV:</h2>
				<p><i>"0" per un unico csv senza limiti</i></p>
				<div class="rob-field-cont">
					<div class="rob-field" style="width: 50%">
						<input type="number" name="rows-number" value="3000" step="1"/>
					</div>
					<div class="rob-field" style="width: 50%">
						<input type="submit" value="Genera"/>
					</div>
				</div>
				<?php
				break;
			case 2:
				?>
				<h2>Generazione CSV</h2>
				<?php
				for ($c = 0; $c < $tot; $c += $rows) {
					$max = $c + $rows;
					if ($max > $tot)
						$max = $tot;

					$pag = floor($c / $rows) + 1;
					?>
					<div class="pad5 grid">
						<div class="w9">
							Righe da <?= $c + 1 ?> a <?= $max ?>
						</div>
						<div class="w3" data-csvpage="<?= $pag ?>" data-csvexecuted="0"></div>
					</div>
					<?php
				}
				break;
		}
		?>
	</form>
</fieldset>
