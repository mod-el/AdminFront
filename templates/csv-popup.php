<fieldset class="pad10" style="width: 450px">
	<form action="?" method="post" onsubmit="let rowsNumber = this['rows-number'].getValue(true); zkPopup({'url':'<?= $this->model->_AdminFront->getUrlPrefix() . $this->model->_AdminFront->request[0] ?>', 'get':{'sId':'<?= $_GET['sId'] ?>','csv':'popup2'}, 'post':{'rows-number':rowsNumber}}, {'onLoad': () => { checkForCsvExport('<?= $_GET['sId'] ?>', rowsNumber); }}); return false" id="form-esporta-csv">
		<?php
		switch ($_GET['csv']) {
			case 'popup':
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
			case 'popup2':
				if (!isset($_POST['rows-number']))
					die('Dati errati');
				?>
				<h2>Generazione CSV</h2>
				<?php
				$this->model->_Admin->getList();
				$tot = $this->model->_Admin->paginator->options['tot'];
				for ($c = 0; $c < $tot; $c += $_POST['rows-number']) {
					$max = $c + $_POST['rows-number'];
					if ($max > $tot)
						$max = $tot;

					$pag = floor($c / $_POST['rows-number']) + 1;
					?>
					<div class="pad5 grid">
						<div class="w9">
							Righe da <?= $c + 1 ?> a <?= $max ?>
						</div>
						<div class="w3" data-csvpage="<?= $pag ?>" data-csvperpage="<?= $_POST['rows-number'] ?>" data-csvexecuted="0"></div>
					</div>
					<?php
				}
				break;
		}
		?>
	</form>
</fieldset>
